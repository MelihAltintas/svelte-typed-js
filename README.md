[![npm version](https://badge.fury.io/js/svelte-typed-js.svg)](https://www.npmjs.com/package/svelte-typed-js) &bull; [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/MelihAltintas/svelte-typed-js/blob/master/LICENSE) &bull; [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/MelihAltintas/svelte-typed-js.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/MelihAltintas/svelte-typed-js/context:javascript) 

# svelte-typed-js


A Svelte.js integration for Typed.js.

Typed.js is a library that types. Enter in any string, and watch it type at the speed you've set, backspace what it's typed, and begin a new sentence for however many strings you've set.

Checkout the offical project [here](https://github.com/mattboldt/typed.js/).

**Demo**: https://svelte.dev/repl/823ca24caab143a6896f22fb853a83d0?version=3

## Table of contents

- [Installation](#installation)
- [Usage](#usage)

# Installation

```
npm install --save svelte-typed-js
```

# Usage

Minimal setup:

```javascript
import SvelteTypedJs from 'svelte-typed-js'
```

```html
<SvelteTypedJs strings={['First text', 'Second Text']} loop=true>
	<h2 class="typing"></h2>
</SvelteTypedJs>
```

The `typing` class also allows you to just animate certain parts of a string:
```html
<SvelteTypedJs :strings="['Melih', 'Altintas']">
  <h1>Hey <span class="typing"></span></h1>
</SvelteTypedJs>
```

## Properties
You can make use of the following properties in order to customize your typing expirience:

| Property             | Type    | Description                                                          
|----------------------|---------|----------------------------------------------------------------------
| strings              | Array   | strings to be typed                                                  
| stringsElement       | String  | ID of element containing string children                                                                                             
| typeSpeed            | Number  | type speed in milliseconds                                                                                                           
| startDelay           | Number  | time before typing starts in milliseconds                                                                                            
| backSpeed            | Number  | backspacing speed in milliseconds                                                
| smartBackspace       | Boolean | only backspace what doesn't match the previous string          
| shuffle              | Boolean | shuffle the strings                                                                                                              
| backDelay            | Number  | time before backspacing in milliseconds                                                                                        
| fadeOut              | Boolean | Fade out instead of backspace                                                                                                   
| fadeOutClass         | String  | css class for fade animation                                                                                                         
| fadeOutDelay         | Number | fade out delay in milliseconds                                                                                                 
| loop                 | Boolean | loop strings                                                                                                                     
| loopCount            | Number  | amount of loops                                                                                                                   
| showCursor           | Boolean | show cursor                                                                                                                  
| cursorChar           | String  | character for cursor                                                                                                         
| autoInsertCss        | Boolean | insert CSS for cursor and fadeOut into HTML                                                                                        
| attr                 | String  | attribute for typing Ex: input placeholder, value, or just HTML text                                                                 
| bindInputFocusEvents | Boolean | bind to focus and blur if el is text input                                                                                          
| contentType          | String  | 'html' or 'null' for plaintext                                                                                                    


# License

[MIT](http://opensource.org/licenses/MIT)