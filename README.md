# labeledpipe

[![CircleCI](https://circleci.com/gh/factset/labeledpipe.svg?style=svg)](https://circleci.com/gh/factset/labeledpipe)
[![codecov.io](https://codecov.io/github/factset/labeledpipe/coverage.svg?branch=master)](https://codecov.io/github/factset/labeledpipe?branch=master)
[![Dependency Status](https://david-dm.org/factset/labeledpipe.svg)](https://david-dm.org/factset/labeledpipe)
[![devDependency Status](https://david-dm.org/factset/labeledpipe/dev-status.svg)](https://david-dm.org/factset/labeledpipe#info=devDependencies)

> [Lazypipe](https://github.com/OverZealous/lazypipe) with optional labels.

Like lazypipe, labeledpipe creates an immutable lazily initialized pipeline.
Unlike lazypipe it allows pipeline stages to be labeled.  You can then use those
labels to control where pipeline stages are added, and even remove previously
added stages.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Installation](#installation)
- [Usage](#usage)
  - [Basic](#basic)
  - [Labeling stages](#labeling-stages)
  - [Cursor Movement](#cursor-movement)
  - [Removing Stages](#removing-stages)
  - [Nested Pipelines](#nested-pipelines)
  - [Pseudo Stages](#pseudo-stages)
  - [Mixing with lazypipe](#mixing-with-lazypipe)
  - [Events](#events)
    - [Errors](#errors)
- [Debugging](#debugging)
- [Node Support Policy](#node-support-policy)
- [Contributing](#contributing)
- [Copyright](#copyright)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

To install `labeledpipe` for use in your project please run the following command:

```bash
yarn add labeledpipe
```

If you are using the `npm` package manager:

```bash
npm install labeledpipe
```

## Usage

### Basic

In this example we use labeledpipe exactly as we would use lazypipe.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

// create a pipeline
var pipeline = labeledpipe()
    .pipe(reportStage, 'A')
    .pipe(reportStage, 'B')
;

// create a stream from the pipeline
var stream = pipeline();

// We could also have piped to the stream created from our pipeline
// var stream = through.obj()
//     .pipe(pipeline())
// ;

// write some data to the stream and close it.
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
B: Some data
```

### Labeling stages

To label a stage of the pipeline, we just prefix arguments to `.pipe` with the
stages label:

```javascript
var pipeline = labeledpipe()
    .pipe('stage-label', reportStage, 'A')
;
```

We can now use the stage labels to change the point at which `.pipe` inserts the
next pipeline stage.  labeledpipe refers to this point as the cursor.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

// create a pipeline
var pipeline = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('stage-B', reportStage, 'B')
    // position the cursor before the stage labeled 'stage-B'
    .before('stage-B')
    .pipe('stage-C', reportStage, 'C')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
C: Some data
B: Some data
```

### Cursor Movement

In addition to `.before`, labeledpipe allows several other cursor positioning
commands.  Here is a complete list:

  * `.before(label)`
  * `.after(label)`
  * `.first()`
  * `.last()`
  * `.beginningOf(label)`
  * `.endOf(label)`

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

// create a pipeline
var pipeline = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('stage-B', reportStage, 'B')
    .pipe('stage-C', reportStage, 'C')

    // insert before stage B
    .before('stage-B')
    .pipe(reportStage, 'A/B')

    // insert after stage B
    .after('stage-B')
    .pipe(reportStage, 'B/C')

    // insert at the beginning of the pipeline
    .first()
    .pipe(reportStage, 'Start')

    // insert at the end of the pipeline
    .last()
    .pipe(reportStage, 'Finish')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
Start: Some data
A: Some data
A/B: Some data
B: Some data
B/C: Some data
C: Some data
Finish: Some data
```

### Removing Stages

Labeledpipe also lets you remove labeled stages that were previously added to
the pipeline.  This allows you to use most of a pipeline created by another
project

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

// create a pipeline
var pipeline = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('stage-B', reportStage, 'B')
    .pipe('stage-C', reportStage, 'C')

    //remove stage-B
    .remove('stage-B')

    // continue working with pipeline
    .pipe(reportStage, 'D')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
C: Some data
D: Some data
```

### Nested Pipelines

Like lazypipe, labeledpipe also lets you nest pipelines.  This allows common
pipeline to be written once and used in multiple pipelines.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

var common = labeledpipe()
    .pipe(reportStage, 'A')
    .pipe(reportStage, 'B')
    .pipe(reportStage, 'C')
;

// create a pipeline
var pipeline = labeledpipe()
    .pipe(common)
    // continue working with pipeline
    .pipe(reportStage, 'D')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
B: Some data
C: Some data
D: Some data
```

Unlike lazypipe however, you can also label the common pipelines and use the
cursor positioning commands to position relative to both the nested pipeline
itself, and the stages in the nested pipeline:

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

var common = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('stage-B', reportStage, 'B')
    .pipe('stage-C', reportStage, 'C')
;

// create a pipeline
var pipeline = labeledpipe()
    .pipe('common-stage', common)

    // insert before common
    .before('common-stage')
    .pipe(reportStage, 'before-common')

    // insert at beginning of common
    .beginningOf('common-stage')
    .pipe(reportStage, 'beginning-of-common')

    // insert at end of common
    .endOf('common-stage')
    .pipe(reportStage, 'end-of-common')

    // insert after common
    .after('common-stage')
    .pipe(reportStage, 'after-common')

    // insert into common
    .after('stage-B')
    .pipe(reportStage, 'inside-common')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
before-common: Some data
beginning-of-common: Some data
A: Some data
B: Some data
inside-common: Some data
C: Some data
end-of-common: Some data
after-common: Some data
```

### Pseudo Stages

Labeledpipe lets you add labeled stages that do not contain a transform
stream.  These are useful if you need to provide well know extension points.
Theses pseudo stages act like nested pipelines.  As such you can use the
nested pipeline movement operators:

  * `.beginningOf(label)`
  * `.endOf(label)`

These operators move the cursor to just after the beginning or just before the
end of the pseudo stage.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

// create a pipeline
var pipeline = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('extend-here')
    .pipe('stage-B', reportStage, 'B')

    // Add something right before the end of the extend-here marker
    .endOf('extend-here')
    .pipe('stage-Y', reportStage, 'Y')

    // Add something right after the beginning of the extend-here marker
    .beginningOf('extend-here')
    .pipe('stage-X', reportStage, 'X')

    // Add something right before the end of the extend-here marker
    .endOf('extend-here')
    .pipe('stage-Z', reportStage, 'Z')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
X: Some data
Y: Some data
Z: Some data
B: Some data
```

### Mixing with lazypipe

Labeledpipe is designed to work seamlessly with lazypipe.  Lazypipes can be used
as stages in a labeledpipe:

```javascript
var labeledpipe = require('labeledpipe');
var lazypipe    = require('lazypipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

var lazyPipeline = lazypipe()
    .pipe(reportStage, 'A')
    .pipe(reportStage, 'B')
    .pipe(reportStage, 'C')
;

// create a pipeline
var pipeline = labeledpipe()
    .pipe('lazy', lazyPipeline)

    // insert before lazy
    .before('lazy')
    .pipe(reportStage, 'before-lazy')

    // insert after lazy
    .after('lazy')
    .pipe(reportStage, 'after-lazy')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
before-lazy: Some data
A: Some data
B: Some data
C: Some data
after-lazy: Some data
```

Similarly, labeledpipes can be used a stages in a lazypipe:

```javascript
var labeledpipe = require('labeledpipe');
var lazypipe    = require('lazypipe');
var through     = require('through2');

// A simple transform stream that reports the stage name to the console.
function reportStage (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        done(null, obj);
    });
}

var labeledPipeline = labeledpipe()
    .pipe('stage-A', reportStage, 'A')
    .pipe('stage-B', reportStage, 'B')
    .pipe('stage-C', reportStage, 'C')
;

// create a pipeline
var pipeline = lazypipe()
    .pipe(reportStage, 'before-labeled')
    .pipe(labeledPipeline)
    .pipe(reportStage, 'after-labeled')
;

// create a stream from the pipeline
var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
before-labeled: Some data
A: Some data
B: Some data
C: Some data
after-labeled: Some data
```

### Events
The labeledpipe object exports all of the chainable event emitter methods:

  * addListener
  * on
  * once
  * removeListener
  * removeAllListeners
  * setMaxListeners

The allows events handlers to be added to a pipeline as if the pipeline was
being constructed immediately.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

function emitEvent (name) {
    return through.obj(function (obj, enc, done) {
        console.log(name + ':', obj);
        this.emit(name, name);
        done(null, obj);
    });
}

var pipeline = labeledpipe()
    .pipe(emitEvent, 'A')
    .on('A', console.log.bind(console, 'Event:'))
    .pipe(emitEvent, 'B')
    .on('B', console.log.bind(console, 'Event:'))
;

var stream = pipeline();
stream.write('Some data');
stream.end();
```

Output:

```bash
A: Some data
Event: A
B: Some data
Event: B
```

#### Errors

Error events are a special case in node already.  This treatment continues in
labeledpipe.  By default, error events on pipeline's streams "bubble up" and are
re-emitted on the pipeline stream.  For example:

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

function returnError (name) {
    return through.obj(function (obj, enc, done) {
        done(new Error(name));
    });
}

var stream = labeledpipe()
    .pipe(returnError, 'A')
    ()
;

stream.on('error', function (error) {
    console.log('Stream Hander:', error.message);
});

stream.write('my data');
stream.end();
```

Output:
```bash
Stream Hander: A
```

However, if you add an error handler to a pipeline stage, error event from that stage will no longer bubble up to the
stream.

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

function returnError (name) {
    return through.obj(function (obj, enc, done) {
        done(new Error(name));
    });
}

var stream = labeledpipe()
    .pipe(returnError, 'A')
    .on('error', function (error) {
        console.log('Pipeline Hander:', error.message);
    })
    ()
;

stream.on('error', function (error) {
    console.log('Stream Hander:', error.message);
});

stream.write('my data');
stream.end();
```

Output:
```bash
Pipeline Hander: A
```

The same rules apply to sub pipelines

```javascript
var labeledpipe = require('labeledpipe');
var through     = require('through2');

function returnError (name) {
    return through.obj(function (obj, enc, done) {
        done(new Error(name));
    });
}

var stream = labeledpipe()
    .pipe(labeledpipe()
        .pipe(returnError, 'A')
        .on('error', function (error) {
            console.log('Sub-pipeline Hander:', error.message);
            this.push('More data');
        })
        .pipe(returnError, 'B')
    )
    .on('error', function (error) {
        console.log('Pipeline Hander:', error.message);
        this.push('More data');
    })
    .pipe(returnError, 'C')
    ()
;

stream.on('error', function (error) {
    console.log('Stream Hander:', error.message);
});

stream.write('my data');
stream.end();
```

Output:
```bash
Sub-pipeline Hander: A
Pipeline Hander: B
Stream Hander: C
```

## Debugging

To assist users of `labeledpipe` with debugging the behavior of this module we use the [debug](https://www.npmjs.com/package/debug) utility package to print information to the console. To enable debug message printing, the environment variable `DEBUG`, which is the variable used by the `debug` package, must be set to a value configured by the package containing the debug messages to be printed.

To print debug messages on a unix system set the environment variable `DEBUG` with the name of this package prior to executing a tool that invokes this module:

```bash
DEBUG=labeledpipe [CONSUMING TOOL]
```

On the Windows command line you may do:

```bash
set DEBUG=labeledpipe
[CONSUMING TOOL]
```

## Node Support Policy

We only support [Long-Term Support](https://github.com/nodejs/LTS) versions of Node.

We specifically limit our support to LTS versions of Node, not because this package won't work on other versions, but because we have a limited amount of time, and supporting LTS offers the greatest return on that investment.

It's possible this package will work correctly on newer versions of Node. It may even be possible to use this package on older versions of Node, though that's more unlikely as we'll make every effort to take advantage of features available in the oldest LTS version we support.

As each Node LTS version reaches its end-of-life we will remove that version from the `node` `engines` property of our package's `package.json` file. Removing a Node version is considered a breaking change and will entail the publishing of a new major version of this package. We will not accept any requests to support an end-of-life version of Node. Any merge requests or issues supporting an end-of-life version of Node will be closed.

We will accept code that allows this package to run on newer, non-LTS, versions of Node. Furthermore, we will attempt to ensure our own changes work on the latest version of Node. To help in that commitment, our continuous integration setup runs against all LTS versions of Node in addition the most recent Node release; called _current_.

JavaScript package managers should allow you to install this package with any version of Node, with, at most, a warning if your version of Node does not fall within the range specified by our `node` `engines` property. If you encounter issues installing this package, please report the issue to your package manager.

## Contributing

Please read our [contributing guide](https://github.com/factset/labeledpipe/blob/master/CONTRIBUTING.md) to see how you may contribute to this project.

## Copyright

Copyright 2017 FactSet Research Systems Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
