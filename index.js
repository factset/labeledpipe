'use strict';

var combine = require('stream-combiner');
var slice   = Array.prototype.slice;

module.exports = labeledpipe;

// create labeledPipe
function labeledpipe () {
    return createPipeline([], 0);
}

function createPipeline (steps, cursor) {
    runPipeline.pipe          = pipe;
    runPipeline.before        = before;
    runPipeline.after         = after;
    runPipeline.remove        = remove;
    runPipeline.first         = first;
    runPipeline.last          = last;
    runPipeline.appendStepsTo = appendStepsTo;

    return runPipeline;

    function runPipeline () {
        var streams = steps
            .filter(hasTask)
            .map(function (step) { return step.task.apply(null, step.args); })
        ;

        return combine(streams);
    }

    function hasTask (step) {
        return !!step.task;
    }

    function pipe (/*[label], [task], [args...]*/) {
        var args       = slice.call(arguments);
        var label      = ('string' === typeof args[0]) && args.shift();
        var task       = (args[0] instanceof Function) && args.shift();
        var spliceArgs = [ cursor, 0 ];

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

        var stepsCopy = steps.slice();
        stepsCopy.splice.apply(stepsCopy, spliceArgs);
        return createPipeline(stepsCopy, cursor + spliceArgs.length - 2);
    }

    function before (label) {
        var location = findLabel(label, 'Unable to move cursor before step ');
        return createPipeline(steps.slice(), location.start);
    }

    function after (label) {
        var location = findLabel(label, 'Unable to move cursor after step ');
        return createPipeline(steps.slice(), location.end + 1);
    }

    function remove (label) {
        var location  = findLabel(label, 'Unable to remove step ');
        var newCursor = (cursor < location.start) ? cursor :
            (cursor <= location.end) ? location.start : (cursor - location.length);

        var stepsCopy = steps.slice();
        stepsCopy.splice(location.start, location.length);
        return createPipeline(stepsCopy, newCursor);
    }

    function findLabel (label, errorPrefix) {
        for (var start = 0; start < steps.length; start += 1) {
            if (label === steps[start].label && steps[start].start) {
                break;
            }
        }

        var length = 1;
        for (var end = start; end < steps.length; end += 1, length += 1) {
            if (label === steps[end].label && steps[end].end) {
                return { start: start, end: end, length: length };
            }
        }

        throw Error(errorPrefix + label);
    }

    function first () {
        return createPipeline(steps.slice(0), 0);
    }

    function last () {
        return createPipeline(steps.slice(0), steps.length);
    }

    function appendStepsTo (otherSteps, keepLabels) {
        return otherSteps.concat(keepLabels ? steps : steps.filter(hasTask));
    }
}
