# JSLog
JSLog is a small JavaScript library for logging your data. 

```javascript
var txt = "JavaScript syntax highlighting", 
    a = 25,
    b = false, 
    c = "other text";
log(txt, a, b, c);
```

And the result is:

![alt tag](http://jaroo.eu/jslog.jpg)


Forget about:
```javascript
var txt = "JavaScript syntax highlighting", 
    a = 25,
    b = false, 
    c = "other text";
console.log(txt);
console.log("a: ", a);
console.log("b: ", b);
console.log("c: ", c);
```

Just insert JS file on your site (before other scripts of course)
```
<script src="JSLog.js"></script>
```

Compatible with Chrome. Other browsers in progress...

