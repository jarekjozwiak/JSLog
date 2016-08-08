(function() {
    'use strict';

    var siteUrl = location.protocol + '//' + location.host;

    var Tools = (function(){
        return {
            d: function(val) {return typeof val !== 'undefined' && val !== null;},
            u: function(val) {return !this.d(val);},
            int: function(val) {return parseInt(val, 10);},
            float: function(val) {return parseFloat(val, 10);},
            clone: function(obj) {
                var copy;

                if (null === obj || 'object' !== typeof obj){
                    return obj;
                }

                if (obj instanceof Date) {
                    copy = new Date();
                    copy.setTime(obj.getTime());
                    return copy;
                }

                if (obj instanceof Array) {
                    copy = [];
                    for (var i = 0, len = obj.length; i < len; i++) {
                        copy[i] = this.clone(obj[i]);
                    }
                    return copy;
                }

                if (obj instanceof Object) {
                    copy = {};
                    for (var attr in obj) {
                        if (obj.hasOwnProperty(attr)) copy[attr] = this.clone(obj[attr]);
                    }
                    return copy;
                }

                return obj;
            },
            getBrowser: function () {
                var ua = navigator.userAgent, tem,
                    M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
                if (/trident/i.test(M[1])) {
                    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
                    return 'IE ' + (tem[1] || '');
                }
                if (M[1] === 'Chrome') {
                    tem = ua.match(/\bOPR\/(\d+)/);
                    if (tem != null) return 'Opera ' + tem[1];
                }
                M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
                if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
                return M.join(' ');
            }
        }
    })();

    var Cache = function() {
        var that = this, cacheData = {}, cacheFieldsMethods = {};

        that.getField = function(field) {
            if (Tools.u(cacheData[field])) {
                cacheData[field] = cacheFieldsMethods[field]();
            }
            return cacheData[field];
        };

        that.addField = function(name, callback) {
            cacheFieldsMethods[name] = callback;
        };
    };

    var Stack = function(stack) {
        var that = this;
        that.__proto__ = new Cache();

        var getCallerLineFromStack = function() {
            return that.getField('callerLine');
        };

        var getFileFromCallerLine = function() {
            var filePath = null, callerLine, callerLineSplit;

            callerLine = getCallerLineFromStack();
            callerLineSplit = callerLine.split(' ');

            if (Tools.d(callerLineSplit[1])) {
                filePath = callerLineSplit[1];
            } else if (Tools.d(callerLineSplit[0])) {
                filePath = callerLineSplit[0];
            }
            return filePath;
        };

        that.addField('callerLine', function() {
            var stackSplit = stack.toString().split('at ');
            if (Tools.u(stackSplit[2])) {
                return '';
            }
            return stackSplit[2].trim();
        });

        that.addField('callerName', function() {
            var callerLine, callerLineSplit;
            callerLine = getCallerLineFromStack();
            callerLineSplit = callerLine.split(' ');
            if (callerLineSplit.length < 2) {
                return '<unknown function>';
            }
            return callerLineSplit[0]
                    .trim()
                    .replace('.this.', '')
                    .replace('._this.', '')
                    .replace('.that.', '');
        });

        that.addField('callerFilePathFull', function() {
            var filePathSplit, filePathSplitLen, qIndex,
                filePathShort = '', filePath, line = 0, column = 0;

            filePath = getFileFromCallerLine();

            if (filePath === null) {
                return {
                    filePathShort: filePathShort,
                    filePath: filePath,
                    column: column,
                    line: line
                };
            }

            filePath = filePath.replace(/[\(\)]/g, '').trim();
            filePathSplit = filePath.split(':');
            filePathSplitLen = filePathSplit.length;

            if (filePathSplitLen > 2) {
                line = Tools.int(filePathSplit[filePathSplitLen - 2]);
                column = Tools.int(filePathSplit[filePathSplitLen - 1]);
            }

            if (!isNaN(column)) {
                filePathSplit.length--;
            }

            if (!isNaN(line)) {
                filePathSplit.length--;
            }

            filePath = filePathSplit.join(':');

            filePathShort = filePath.replace(siteUrl, '');
            qIndex = filePathShort.indexOf('?');

            if (qIndex > -1) {
                filePathShort = filePathShort.substr(0, qIndex);
            }

            return {
                filePathShort: filePathShort,
                filePath: filePath,
                column: column,
                line: line
            };
        });

        that.getCallerName = function() {
            return that.getField('callerName');
        };

        that.getCallerFilePathShort = function() {
            return that.getField('callerFilePathFull').filePathShort;
        };

        that.getCallerFilePath = function() {
            return that.getField('callerFilePathFull').filePath;
        };

        that.getCallerLine = function() {
            return that.getField('callerFilePathFull').line;
        };

        that.getCallerColumn = function() {
            return that.getField('callerFilePathFull').column;
        };

    };

    var File = function(filePath) {
        var that = this,
            isReady = false,
            processing = false,
            callbacksQueue = [],
            content = '';

        that.get = function(callback) {
            callbacksQueue.push(callback);

            if (processing) return;

            if (isReady) {
                runCallbacks();
                return;
            }

            processing = true;

            if (filePath.indexOf('<anonymous>') === -1) {
                startRequest();
            } else {
                requestReady();
            }

        };

        that.isReady = function() {
            return isReady;
        };

        that.getFunctionCallerParams = function(lineNb, columnNb) {
            var contentSplit, line, lineFull, firstBracket, lastBracket,
                caller, callerSplit, callerSplitLength, c, param, result = [],
                lineTempNb, columnTempNb, linesTemp = [], doFlag = true;

            contentSplit = content.split('\n');
            if (Tools.u(contentSplit[lineNb - 1])) {
                return result;
            }

            lineTempNb = lineNb - 1;

            do {
                if (doFlag) {
                    columnTempNb = columnNb - 1;
                    doFlag = false;
                } else {
                    columnTempNb = 0;
                }

                if (Tools.u(contentSplit[lineTempNb])) {
                    break;
                }

                line = contentSplit[lineTempNb].substr(columnTempNb);
                linesTemp.push(line);
                lastBracket = line.indexOf(')');
                lineTempNb++;
            } while(lastBracket === -1);

            lineFull = linesTemp.join('').trim();

            firstBracket = lineFull.indexOf('(');
            lastBracket = lineFull.lastIndexOf(')');

            caller = lineFull.substring(firstBracket + 1, lastBracket);
            callerSplit = caller.split(',');
            callerSplitLength = callerSplit.length;

            for (c = 0; c < callerSplitLength; c++) {
                param = callerSplit[c].trim();
                if (param[0] === '\'') {
                    param = '';
                }
                result.push(param);
            }

            return result;
        };

        var startRequest = function() {
            var oReq;
            oReq = new XMLHttpRequest();
            oReq.onload = function() {
                if (oReq.status === 200) {
                    content = oReq.responseText || oReq.response;
                }
                requestReady();
            };
            oReq.open('get', filePath, true);
            oReq.send();
        };

        var requestReady = function() {
            isReady = true;
            processing = false;
            runCallbacks();
        };

        var runCallbacks = function() {
            var callback;
            while (callbacksQueue.length) {
                callback = callbacksQueue.shift();
                typeof callback === 'function' && callback();
            }
        };

    };

    var LogEngine = function(withStyle) {
        var that = this,
            lastLog = null,
            logQueue = [],
            filesProcessed = {};

        that.addLog = function(errStack, args) {
            var file, stack;
            stack = new Stack(errStack);
            file = getFile(stack.getCallerFilePath());

            addToQueue({
                stack: stack,
                file: file,
                args: args
            });

        };

        var addToQueue = function(logObj) {
            logQueue.push(logObj);
            logObj.file.get(run);
        };

        var run = function() {
            if (logQueue.length === 0) {
                return;
            }
            if (logQueue[0].file.isReady()) {
                showLog(logQueue.shift());
                run();
            }
        };

        var showLog = function(logObj) {
            var stack, file, args, argsLength, a, isDefined, callerParams,
                key, value, prefixStyle, style, callerFilePathSort;

            stack = logObj.stack;
            file = logObj.file;
            args = logObj.args;
            argsLength = args.length;
            isDefined = Tools.d;

            callerParams = file.getFunctionCallerParams(
                stack.getCallerLine(),
                stack.getCallerColumn()
            );

            prefixStyle = withStyle ? '%c' : '';

            callerFilePathSort = stack.getCallerFilePathShort();

            if (lastLog === null || lastLog.stack.getCallerFilePathShort() !== callerFilePathSort) {
                style = withStyle ? 'color: black; background: #eee; padding: 4px 0; font-weight: bold;' : '';
                console.info(prefixStyle + callerFilePathSort, style);
            }

            style = withStyle ? 'font-weight: bold; padding: 4px 0;' : '';
            console.log(
                prefixStyle + '  ' + stack.getCallerName() + ' [' + stack.getCallerLine() + ', ' + stack.getCallerColumn() + ']',
                style
            );

            for (a = 0; a < argsLength; a++) {
                value = args[a];
                if (isDefined(callerParams[a]) && callerParams[a].length) {
                    key = callerParams[a] + ':';
                    console.log('    ', key, value);
                } else {
                    console.log('    ', value);
                }
            }
            console.log('');
            lastLog = logObj;

        };

        var getFile = function(filePath) {
            if (Tools.u(filesProcessed[filePath])) {
                filesProcessed[filePath] = new File(filePath);
            }
            return filesProcessed[filePath];
        };

    };

    var logEngineI, browser, browserWithStyle, browserWithStyleLen, b, hasStyles;

    browserWithStyle = ['chrome', 'firefox', 'opera'];
    browserWithStyleLen = browserWithStyle.length;
    browser = Tools.getBrowser().toLowerCase();
    hasStyles = false;

    for (b = 0; b < browserWithStyleLen; b++) {
        if (browser.indexOf(browserWithStyle[b]) > -1) {
            hasStyles = true;
            break;
        }
    }

    logEngineI = new LogEngine(hasStyles);

    window.log = function() {
        var err, cloneArgs = [], argumentsLength, a;
        if (typeof console === 'undefined' || typeof console.log !== 'function') {
            return;
        }

        argumentsLength = arguments.length;
        for (a = 0; a < argumentsLength; a++) {
            //cloneArgs.push(Tools.clone(arguments[a]));
            cloneArgs.push(arguments[a]);
        }

        err = new Error();
        logEngineI.addLog(err.stack, cloneArgs);

    };

})();

