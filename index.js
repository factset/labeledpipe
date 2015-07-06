'use strict';

var duplexer = require('duplexer2');
var through  = require('through2');
var copy     = require('shallow-copy');
var slice    = Array.prototype.slice;

module.exports = labeledpipe;

// create labeledPipe
function labeledpipe (displayName) {
    return new LabeledPipe(displayName, [], 0);
}

labeledpipe.LabeledPipe = LabeledPipe;

function LabeledPipe (displayName, steps, cursor) {
    this._steps            = steps;
    this._cursor           = cursor;
    this.build             = this.build.bind(this);
    this.build.displayName = displayName;

    Object
        .keys(LabeledPipe.prototype)
        .forEach(function (method) {
            this.build[method] = this[method].bind(this);
        }, this)
    ;

    return this.build;
}

LabeledPipe.prototype = {
    pipe: function (/*[label], [task], [args...]*/) {
        var args       = slice.call(arguments);
        var label      = ('string' === typeof args[0]) && args.shift();
        var task       = (args[0] instanceof Function) && args.shift();
        var spliceArgs = [ this._cursor, 0 ];

        // if we're adding a labeledpipe or a lazypipe, add begining and end markers.
        if (task.appendStepsTo instanceof Function) {
            spliceArgs.push({ label: label, start: true, end: false });
            spliceArgs = task.appendStepsTo(spliceArgs, true);
            spliceArgs.push({ label: label, start: false, end: true });
        }
        else {
            spliceArgs.push({
                label: label,
                task:  task,
                args:  args,
                start: true,
                end:   true
            });
        }

        var stepsCopy = this.steps();
        stepsCopy.splice.apply(stepsCopy, spliceArgs);
        return new LabeledPipe(this.build.displayName, stepsCopy, this._cursor + spliceArgs.length - 2);
    },

    before: function (label) {
        var location = findLabel(this, label, 'Unable to move cursor before step ');
        return new LabeledPipe(this.build.displayName, this.steps(), location.start);
    },

    after: function (label) {
        var location = findLabel(this, label, 'Unable to move cursor after step ');
        return new LabeledPipe(this.build.displayName, this.steps(), location.end + 1);
    },

    remove: function (label) {
        var location  = findLabel(this, label, 'Unable to remove step ');
        var newCursor = (this._cursor < location.start) ? this._cursor :
            (this._cursor <= location.end) ? location.start : (this._cursor - location.length);

        var stepsCopy = this.steps();
        stepsCopy.splice(location.start, location.length);
        return new LabeledPipe(this.build.displayName, stepsCopy, newCursor);
    },

    first: function () {
        return new LabeledPipe(this.build.displayName, this.steps(), 0);
    },

    last: function () {
        return new LabeledPipe(this.build.displayName, this.steps(), this._steps.length);
    },

    appendStepsTo: function (otherSteps, keepLabels) {
        if (keepLabels) {
            return otherSteps.concat(this._steps);
        }

        return otherSteps.concat(reduceSteps(this.steps()).filter(hasTask));
    },

    build: function () {
        var steps = reduceSteps(this.steps());

        steps.unshift({ start: true, end: false });
        steps.push({ start: false, end: true });

        return combine(steps);
    },

    steps: function () {
        return this._steps.slice();
    }
};

// proxy event emitter methods to the transform under the cursor
LabeledPipe.CHAINABLE_EVENT_EMITTER_METHODS = [
    'addListener',
    'on',
    'once',
    'removeListener',
    'removeAllListeners',
    'setMaxListeners'
];

LabeledPipe
    .CHAINABLE_EVENT_EMITTER_METHODS
    .forEach(function (method) {
        LabeledPipe.prototype[method] = function () {
            if (!this._cursor) {
                throw new Error('No event emitter under cursor');
            }

            var stepIndex = this._cursor - 1;
            var args      = slice.call(arguments);
            var stepsCopy = this.steps();

            stepsCopy[stepIndex]        = copy(stepsCopy[stepIndex]);
            stepsCopy[stepIndex].events = (stepsCopy[stepIndex].events || []).concat({
                method: method,
                args:   args
            });

            return new LabeledPipe(this.build.displayName, stepsCopy, this._cursor);
        };
    })
;

function hasTask (step) {
    return !!step.task;
}

function findLabel (pipe, label, errorPrefix) {
    for (var start = 0; start < pipe._steps.length; start += 1) {
        if (label === pipe._steps[start].label && pipe._steps[start].start) {
            break;
        }
    }

    var length = 1;
    for (var end = start; end < pipe._steps.length; end += 1, length += 1) {
        if (label === pipe._steps[end].label && pipe._steps[end].end) {
            return { start: start, end: end, length: length };
        }
    }

    throw Error(errorPrefix + label);
}

function reduceSteps (steps) {
    var matching = [];

    for (var end = 0; end < steps.length; end += 1) {
        var step = steps[end];

        if (step.start || !step.end) {
            matching.unshift(end);
        }

        if (step.events) {
            var start = matching[0];
            steps.splice(start, 0, { task: combineEvents, args: [ steps.splice(start, end - start + 1) ] });
            end = start;
        }

        if (!step.start || step.end) {
            matching.shift();
        }
    }

    return steps;
}

function combineEvents (steps) {
    var result = combine(steps);

    steps[steps.length - 1].events.forEach(function (event) {
        result[event.method].apply(result, event.args);
    });

    return result;
}

function combine (steps) {
    var index;
    var tasks = steps
        .filter(hasTask)
        .map(function (step) { return step.task.apply(null, step.args); })
    ;

    if (tasks.length === 0) {
        return through.obj();
    }

    /**
     * If this is a subpipeline with one task, the number of steps is three
     * (the task and the start and end marker).  We want to add error handlers
     * to subpipelines, but not single tasks.
     */
    if (tasks.length === 1 && steps.length === 1) {
        return tasks[0];
    }

    /**
     * Errors returned by the write callback in a duplex stream are emitted on
     * both the writable and the stream itself.  Here we add a stream to the
     * beginning of the set of streams that will never return an error.  That
     * way we have control over what happens to the error events.
     */
    tasks.unshift(through.obj());

    for (index = 1; index < tasks.length; index++) {
        tasks[index - 1].pipe(tasks[index]);
    }

    var result = duplexer({ bubbleErrors: false }, tasks[0], tasks[tasks.length - 1]);
    for (index = 0; index < tasks.length; index++) {
        /**
         * Calling source.pipe(dest), adds an error handler to the destination
         * stream.  So we check wether labeledpipe().on() has been used to add
         * an error handler by checking that the number of error handlers is
         * one.  This won't add a handler to the through stream at the begnning
         * of the pipe, but as previously noted, that stream shouldn't error.
         */
        if (tasks[index].listeners('error').length === 1) {
            tasks[index].on('error', result.emit.bind(result, 'error'));
        }
    }

    return result;
}
