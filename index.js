'use strict';

var through = require('through2');
var slice   = Array.prototype.slice;

module.exports = labeledpipe;

// create labeledPipe
function labeledpipe () {
    return createPipeline([], 0);
}

function createPipeline (steps, cursor) {
    runPipeline.pipe   = pipe;
    runPipeline.before = before;
    runPipeline.after  = after;
    runPipeline.remove = remove;
    return runPipeline;

    function runPipeline () {
        return steps.reduce(function (pipeline, step) {
            return pipeline.pipe(step.transform.apply(null, step.args));
        }, through.obj());
    }

    function pipe (/*[label], [transform], [args...]*/) {
        var args       = slice.call(arguments, 0);
        var label      = (args[0] instanceof String) ? args.shift() : '';
        var transform  = (args[0] instanceof Function) ? args.shift() : through.obj;
        var spliceArgs = [ cursor, 0 ]

        return createPipeline(steps.slice().splice(cursor, 0, {
            label:     label,
            transform: transform,
            args:      args
        }), cursor + 1);
    }

    function before (label) {
        var newCursor = 0;
        for (; newCursor < steps.length; newCursor++) {
            if (label === steps[newCursor].label) {
                return createPipeline(steps.slice(), newCursor);
            }
        }

        throw Error('Unable to move cursor before step ' + label);
    }

    function after (label) {
        var newCursor = 0;
        for (; newCursor < steps.length; newCursor++) {
            if (label === steps[newCursor].label) {
                return createPipeline(steps.slice(), newCursor + 1);
            }
        }

        throw Error('Unable to move cursor after step ' + label);
    }

    function remove (label) {
        var toRemove;
        for (; toRemove < steps.length; toRemove++) {
            if (label === steps[toRemove].label) {
                return createPipeline(steps.slice().splice(toRemove, 1), toRemove > cursor ? cursor : cursor - 1);
            }
        }

        throw Error('Unable to remove step ' + label);
    }
}
