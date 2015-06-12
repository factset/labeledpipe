'use strict';

var coberturaBadger = require('istanbul-cobertura-badger');
coberturaBadger('coverage/cobertura-coverage.xml', 'coverage', function () {});
