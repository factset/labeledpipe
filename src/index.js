'use strict';

var duplexer = require('duplexer2');
var through = require('through2');
var copy = require('shallow-copy');
var slice = Array.prototype.slice;

module.exports = labeledpipe;
module.exports.LabeledPipe = LabeledPipe;

// Create labeledPipe
function labeledpipe(displayName) {
  return new LabeledPipe(displayName, [], 0);
}

/**
 * Construct a new LabeledPipe, and return a function bound to the
 * LabeledPipe's build method.  The returned function also has all of the
 * LabeledPipe's methods bound to similarly named properties.
 *
 * @class
 * @param {string}  displayName A string used to set the displayName property
 *                              of the returned function.
 * @param {Steps[]} steps       A list of LabeledPipe steps for this pipeline.
 * @param {Number}  cursor      The index of the pipeline steop under the
 *                              cursor.
 */
function LabeledPipe(displayName, steps, cursor) {
  this._steps = steps;
  this._cursor = cursor;
  this.build = this.build.bind(this);
  this.build.displayName = displayName;

  Object
    .keys(LabeledPipe.prototype)
    .forEach(function (method) {
      this.build[method] = this[method].bind(this);
    }, this);
  return this.build;
}

LabeledPipe.prototype = {
  /**
     * Create a new pipeline with task inserted at the current cursor location.
     *
     * @param  {string}      [label] Optional. A string that can be used to
     *                               reference this task
     * @param  {function}    [task]  Optional. A function that returns a
     *                               tranform stream.
     * @param  {...*}         args   Any number of arguments that should be
     *                               passed to task when the pipeline is
     *                               constructed.
     * @return {LabeledPipe}         A new LabeledPipe with the task appended.
     */
  pipe: function (/* [label], [task], [args...] */) {
    var args = slice.call(arguments);
    var label = (typeof args[0] === 'string') && args.shift();
    var task = (args[0] instanceof Function) && args.shift();
    var spliceArgs = spliceNewTask([this._cursor, 0], label, task, args);
    var stepsCopy = this.steps();

    stepsCopy.splice.apply(stepsCopy, spliceArgs);
    return new LabeledPipe(this.build.displayName, stepsCopy, this._cursor + spliceArgs.length - 2);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned before label.
     *
     * @param  {string}      label A label currently in the pipeline.
     * @return {LabeledPipe}       A new LabeledPipe.
     */
  before: function (label) {
    var location = findLabel(this, label, 'Unable to move cursor before step ');
    return new LabeledPipe(this.build.displayName, this.steps(), location.start);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned after label
     *
     * @param  {string}      label A label currently in the pipeline
     * @return {LabeledPipe}       A new LabeledPipe.
     */
  after: function (label) {
    var location = findLabel(this, label, 'Unable to move cursor after step ');
    return new LabeledPipe(this.build.displayName, this.steps(), location.end + 1);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned after the start
     * of a subpipeline or marker.
     *
     * @param  {string}      label A label currently in the pipeline
     * @return {LabeledPipe}       A new LabeledPipe.
     */
  beginningOf: function (label) {
    var location = findLabel(this, label, 'Unable to move cursor to the beginning of ');
    return new LabeledPipe(this.build.displayName, this.steps(), location.start + 1);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned before the end of
     * a subpipeline or marker.
     *
     * @param  {string}      label A label currently in the pipeline
     * @return {LabeledPipe}       A new LabeledPipe.
     */
  endOf: function (label) {
    var location = findLabel(this, label, 'Unable to move cursor to the end of ');
    return new LabeledPipe(this.build.displayName, this.steps(), location.end);
  },

  /**
     * Construct a new LabeledPipe with the task at label removed.
     *
     * @param  {string}      label A label currently in the pipeline.
     * @return {LabeledPipe}       A new LabeledPipe.
     */
  remove: function (label) {
    var location = findLabel(this, label, 'Unable to remove step ');
    var newCursor = (this._cursor < location.start) ? this._cursor :
      (this._cursor <= location.end) ? location.start : (this._cursor - location.length);

    var stepsCopy = this.steps();
    stepsCopy.splice(location.start, location.length);
    return new LabeledPipe(this.build.displayName, stepsCopy, newCursor);
  },

  /**
     * Construct a new LabeledPipe with task at label replaced by pipeline. The
     * cursor is not repositioned.
     *
     * @param  {string}       label    A label currently in the pipeline
     * @param  {function}     pipeline A function that returns a transform
     *                                 stream.
     * @return {LabeledPipe}           A new LabeledPipe
     */
  replace: function (label/* , task, args... */) {
    var args = slice.call(arguments, 1);
    var task = (args[0] instanceof Function) && args.shift();
    var location = findLabel(this, label, 'Unable to remove step ');
    var spliceArgs = spliceNewTask([location.start, location.length], label, task, args);
    var newCursor = (this._cursor < location.start) ? this._cursor :
      ((this._cursor <= location.end) ? location.start : (this._cursor - location.length)) + 1;

    var stepsCopy = this.steps();
    stepsCopy.splice.apply(stepsCopy, spliceArgs);
    return new LabeledPipe(this.build.displayName, stepsCopy, newCursor);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned before the first task.
     *
     * @return {LabeledPipe} A new LabeledPipe.
     */
  first: function () {
    return new LabeledPipe(this.build.displayName, this.steps(), 0);
  },

  /**
     * Construct a new LabeledPipe with the cursor positioned after the last task.
     *
     * @return {LabeledPipe} A new LabeledPipe.
     */
  last: function () {
    return new LabeledPipe(this.build.displayName, this.steps(), this._steps.length);
  },

  /**
     * Append the steps in this pipeline to another list of steps.
     *
     * @param  {Step[]}  otherSteps An array of (Labeled|Lazy)Pipe steps
     * @param  {Boolean} keepLabels True if start and end markers should be appended.
     * @return {Step[]}             An array of (Labeled|Lazy)Pipe steps.
     */
  appendStepsTo: function (otherSteps, keepLabels) {
    if (keepLabels) {
      return otherSteps.concat(this._steps);
    }

    return otherSteps.concat(reduceSteps(this.steps()).filter(hasTask));
  },

  /**
     * Construct the current pipeline.
     *
     * @return {stream.Duplex} A duplex stream that wraps all of the steps in
     *                         the pipeline.
     */
  build: function () {
    var steps = reduceSteps(this.steps());

    steps.unshift({start: true, end: false});
    steps.push({start: false, end: true});

    return combine(steps);
  },

  /**
     * Returns a shallow copy of all of the steps in the pipeline.
     *
     * @return {Steps[]} A shallow copy of the pipeline's steps.
     */
  steps: function () {
    return this._steps.slice();
  },
};

// Proxy event emitter methods to the transform under the cursor
LabeledPipe.CHAINABLE_EVENT_EMITTER_METHODS = [
  /**
     * Construct a new LabeledPipe with an event listener added to the pipeline
     * step under the cursor.
     *
     * @function LabeledPipe#addListener
     * @param {string}   event    The name of the event.
     * @param {function} listener The function to call when event is emitted.
     * @return {LabeledPipe} A new LabeledPipe
     */
  'addListener',

  /**
     * Construct a new LabeledPipe with an event listener added to the pipeline
     * step under the cursor.
     *
     * @function LabeledPipe#on
     * @param {string}   event    The name of the event.
     * @param {function} listener The function to call when event is emitted.
     * @return {LabeledPipe} A new LabeledPipe
     */
  'on',

  /**
     * Construct a new LabeledPipe with an event listener that will only be
     * called once, added to the pipeline step under the cursor.
     *
     * @function LabeledPipe#once
     * @param {string}   event    The name of the event.
     * @param {function} listener The function to call when event is emitted.
     * @return {LabeledPipe}      A new LabeledPipe
     */
  'once',

  /**
     * Construct a new LabeledPipe with the listener for the specified event
     * removed from the pipeline step under the cursor.
     *
     * @function LabeledPipe#removeListener
     * @param {string}   event    The name of the event.
     * @param {function} listener The listener that should be removed.
     * @return {LabeledPipe}      A new LabeledPipe
     */
  'removeListener',

  /**
     * Construct a new LabeledPipe with all of the listeners removed from the
     * pipeline step under the cursor.  If an event is specified, only
     * listeners for that event are removed.
     *
     * @function LabeledPipe#removeAllListeners
     * @param {string} [event] Optional. The name of the event whose listeners
     *                         should be removed.
     * @return {LabeledPipe}   A new LabeledPipe
     */
  'removeAllListeners',

  /**
     * Construct a new LabeledPipe with the maximum number of listeners for the
     * pipeline step under the cursor set to max.
     *
     * @function LabeledPipe#setMaxListeners
     * @param {Number} max The number of listeners that can be added before
     *                     warnings are emitted.
     * @return {LabeledPipe} A new LabeledPipe
     */
  'setMaxListeners',
];

LabeledPipe
  .CHAINABLE_EVENT_EMITTER_METHODS
  .forEach(function (method) {
    LabeledPipe.prototype[method] = function () {
      if (!this._cursor) {
        throw new Error('No event emitter under cursor');
      }

      var stepIndex = this._cursor - 1;
      var args = slice.call(arguments);
      var stepsCopy = this.steps();

      stepsCopy[stepIndex] = copy(stepsCopy[stepIndex]);
      stepsCopy[stepIndex].events = (stepsCopy[stepIndex].events || []).concat({
        method: method,
        args: args,
      });

      return new LabeledPipe(this.build.displayName, stepsCopy, this._cursor);
    };
  });

/**
 * Returns true if the step has a task function.
 *
 * @private
 * @param  {Step}    step A LabledPipe step
 * @return {Boolean}      True if the step has a task.
 */
function hasTask(step) {
  return Boolean(step.task);
}

/**
 * Look through a pipeline and find the start and stop index of a specific
 * label.
 *
 * @private
 * @param  {LabledPipe} pipe        The labeledpipe to search
 * @param  {string}     label       The label to searc for
 * @param  {string}     errorPrefix A string used to prefix error messages if
 *                                  the label isn't found.
 * @return {Object}                 An object that contains the index of the
 *                                  start and end of the label, as well as the
 *                                  number of steps in that label
 */
function findLabel(pipe, label, errorPrefix) {
  let start;
  for (start = 0; start < pipe._steps.length; start += 1) {
    if (label === pipe._steps[start].label && pipe._steps[start].start) {
      break;
    }
  }

  var length = 1;
  for (let end = start; end < pipe._steps.length; end += 1, length += 1) {
    if (label === pipe._steps[end].label && pipe._steps[end].end) {
      return {start: start, end: end, length: length};
    }
  }

  throw Error(errorPrefix + label);
}

/**
 * Combine sub-pipelines that have event methods attached.
 *
 * @private
 * @param  {Steps[]} steps An array of labeledpipe steps
 * @return {Steps[]}       An array of labeledpipe steps
 */
function reduceSteps(steps) {
  var matching = [];

  for (var end = 0; end < steps.length; end += 1) {
    var step = steps[end];

    if (step.start || !step.end) {
      matching.unshift(end);
    }

    if (step.events) {
      var start = matching[0];
      steps.splice(start, 0, {task: combineEvents, args: [steps.splice(start, end - start + 1)]});
      end = start;
    }

    if (!step.start || step.end) {
      matching.shift();
    }
  }

  return steps;
}

/**
 * Combine steps into a single Duplex stream, and call event methods on the
 * combined stream.
 *
 * @private
 * @param  {Step[]}        steps An array of labledpipe steps
 * @return {stream.Duplex}       A single duplex stream
 */
function combineEvents(steps) {
  var result = combine(steps);

  steps[steps.length - 1].events.forEach(function (event) {
    result[event.method].apply(result, event.args);
  });

  return result;
}

/**
 * Create a single stream that pipes it's input through each task in steps.
 * Also bubble error events from each task to the resulting stream object,
 * unless those events are already handled.
 *
 * @private
 * @param  {Step[]}        steps An array of labeledpipe steps.
 * @return {stream.Duplex}       A single Duplex stream.
 */
function combine(steps) {
  var index;
  var tasks = steps
    .filter(hasTask)
    .map(function (step) {
      return step.task.apply(null, step.args);
    });
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

  var result = duplexer({bubbleErrors: false}, tasks[0], tasks[tasks.length - 1]);
  for (index = 0; index < tasks.length; index++) {
    /**
         * Calling source.pipe(dest), adds an error handler to the destination
         * stream.  So we check whether labeledpipe().on() has been used to add
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

/**
 * Add arguments to sliceArgs to add task to an array of steps
 *
 * @private
 * @param  {array}    spliceArgs An arguments array that the task new task
 *                               should be added to.
 * @param  {string}   label      The label for the new task.
 * @param  {function} task       The new task function.
 * @param  {array}    args       An array of arguments for the task function.
 * @return {array}               A copy of spliceArgs with the new task added.
 */
function spliceNewTask(spliceArgs, label, task, args) {
  // If we're adding a labeledpipe or a lazypipe, add begining and end markers.
  if (task.appendStepsTo instanceof Function) {
    spliceArgs.push({label: label, start: true, end: false});
    spliceArgs = task.appendStepsTo(spliceArgs, true);
    spliceArgs.push({label: label, start: false, end: true});
  } else if (task) {
    spliceArgs.push({
      label: label,
      task: task,
      args: args,
      start: true,
      end: true,
    });
  } else {
    spliceArgs.push(
      {label: label, start: true, end: false},
      {label: label, start: false, end: true}
    );
  }

  return spliceArgs;
}
