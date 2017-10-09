
# Description

When doing completion from TS service, slightly reorder available completions to keep own non-inherited properties from type at the top of completion list:

## React (especially useful when inherting from HTMLAttributes)


### Before: 
![](/images/react-before.png) 

(Component own properties are messed with HTML ones)

### After: 
![](/images/react-after.png)

(Notice component own properites are being displayed at top)

## Class

### Before
![](/images/class1-before.png)

(Mix own & inherited properties)

### After:
![](/images/class1-after.png)

(Own properties are being displayed at top)

### Before:
![](/images/class2-before.png)

### After:
![](/images/class2-after.png)

(Own properties are being displayed at top)


## Installation

```npm install typescript-type-completion-sorting-plugin --save-dev```

**Add plugin to your tsconfig.json**

```json
    "plugins": [{
         "name": "typescript-type-completion-sorting-plugin"
    }]
```

### Knwon issues
