import * as ts_module from "typescript/lib/tsserverlibrary";


function init(modules: { typescript: typeof ts_module }) {
    const ts = modules.typescript;

    /**
     * Find latest closest node of given types for given position
     */
    function findNodeWithType(sourceFile: ts.SourceFile, position: number, type: ts.SyntaxKind[]): ts.Node | undefined {
        let foundNode: ts.Node = sourceFile;
        function find(node: ts.Node): void {
            // Not checking with end boundaries because expression may be incomplete/incorrect and will have node.getEnd() - 1 position
            if (position >= node.getStart()) {
                if (type.indexOf(node.kind) !== -1 && node.getStart() >= foundNode.getStart()) {
                    foundNode = node;
                }
                ts.forEachChild(node, find);
            }
        }
        find(sourceFile);
        return type.indexOf(foundNode.kind) !== -1 ? foundNode : undefined;
    }

    function create(info: ts.server.PluginCreateInfo) {
        const proxy = Object.create(null) as ts.LanguageService;
        const oldLS = info.languageService;
        const program = info.languageService.getProgram();
        const checker = program.getTypeChecker();

        for (const k in oldLS) {
            (proxy as any)[k] = function () {
                return oldLS[k as keyof ts.LanguageService].apply(oldLS, arguments);
            }
        }

        function getOwnMembersFromContextualType(node: ts.Node): string[] | undefined {
            if (!node) {
                return;
            }

            let type: ts.Type | undefined;
            if (ts.isJsxOpeningLikeElement(node)) {
                type = checker.getAllAttributesTypeFromJsxOpeningLikeElement(node);
            } else if (ts.isPropertyAccessExpression(node)) {
                const contextualNode = node.expression;
                type = checker.getTypeAtLocation(contextualNode);
            }
            if (!type) {
                return;
            }
            const primarySymbols: ts.Symbol[] = [];

            if (type.flags & ts.TypeFlags.UnionOrIntersection) {
                for (const t of (type as ts.UnionOrIntersectionType).types) {
                    const symbol = t.getSymbol();
                    if (symbol && symbol.members) {
                        symbol.members.forEach(v => primarySymbols.push(v));
                    }
                }
            } else {
                const symbol = type.getSymbol();
                if (symbol && symbol.members) {
                    symbol.members.forEach(v => primarySymbols.push(v));
                }
            }

            const members: string[] = [];
            primarySymbols.forEach(v => members.push(v.name));
            return members;
        }

        proxy.getCompletionsAtPosition = (fileName, position) => {
            const prior = info.languageService.getCompletionsAtPosition(fileName, position);
            if (!prior.isMemberCompletion || prior.entries.length === 0) {
                return prior;
            }
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            const node = findNodeWithType(sourceFile, position, [ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.JsxOpeningElement, ts.SyntaxKind.JsxSelfClosingElement]);
            if (!node) {
                return prior;
            }
            const members = getOwnMembersFromContextualType(node);
            if (!members || members.length === 0) {
                return prior;
            }

            // push non primary type members down
            prior.entries = prior.entries.map(entry => {
                if (members.indexOf(entry.name) === -1) {
                    entry.sortText = "1";
                }
                return entry;
            });
            return prior;
        };

        return proxy;
    }

    return { create };
}
export = init;