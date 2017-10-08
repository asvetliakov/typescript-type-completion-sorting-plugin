import * as ts_module from "typescript/lib/tsserverlibrary";


function init(modules: { typescript: typeof ts_module }) {
    const ts = modules.typescript;

    function findNode(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
        function find(node: ts.Node): ts.Node | undefined {
            if (position >= node.getStart() && position <= node.getEnd()) {
                return ts.forEachChild(node, find) || node;
            }
        }
        return find(sourceFile);
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
            if (!node || !node.parent) {
                return;
            }
            let type: ts.Type | undefined;
            if (node.kind === ts.SyntaxKind.JsxOpeningElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
                type = checker.getAllAttributesTypeFromJsxOpeningLikeElement(node as ts.JsxOpeningLikeElement);
            } else if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const contextualNode = (node.parent as ts.PropertyAccessExpression).expression;
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
            if (!prior.isMemberCompletion) {
                return prior;
            }
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            const node = findNode(sourceFile, position);
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