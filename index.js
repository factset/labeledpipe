'use strict';

var combine = require('stream-combiner');
var slice   = Array.prototype.slice;

module.exports = labeledpipe;

// create labeledPipe
function labeledpipe (displayName) {
    return new LabeledPipe(displayName, [], 0);
}

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
            spliceArgs.push({ label: label, start: true });
            spliceArgs = task.appendStepsTo(spliceArgs, true);
            spliceArgs.push({ label: label, end: true });
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
        var location = this.findLabel(label, 'Unable to move cursor before step ');
        return new LabeledPipe(this.build.displayName, this.steps(), location.start);
    },

    after: function (label) {
        var location = this.findLabel(label, 'Unable to move cursor after step ');
        return new LabeledPipe(this.build.displayName, this.steps(), location.end + 1);
    },

    remove: function (label) {
        var location  = this.findLabel(label, 'Unable to remove step ');
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
        return otherSteps.concat(keepLabels ? this._steps : this._steps.filter(hasTask));
    },

    build: function () {
        var streams = this._steps
            .filter(hasTask)
            .map(function (step) { return step.task.apply(null, step.args); })
        ;

        return combine(streams);

    },

    findLabel: function (label, errorPrefix) {
        for (var start = 0; start < this._steps.length; start += 1) {
            if (label === this._steps[start].label && this._steps[start].start) {
                break;
            }
        }

        var length = 1;
        for (var end = start; end < this._steps.length; end += 1, length += 1) {
            if (label === this._steps[end].label && this._steps[end].end) {
                return { start: start, end: end, length: length };
            }
        }

        throw Error(errorPrefix + label);
    },

    steps: function () {
        return this._steps.slice();
    }
};

function hasTask (step) {
    return !!step.task;
}
