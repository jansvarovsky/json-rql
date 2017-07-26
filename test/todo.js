var _ = require('lodash'),
    _fs = require('fs'),
    _path = require('path'),
    _jrql = require('../index'),
    readline = require('readline'),
    pass = require('pass-error'),
    stringify = require('json-stringify-pretty-compact'),
    sparqlFolder = _path.join(__dirname, '../node_modules/sparqljs/queries'),
    dataFolder = _path.join(__dirname, 'data');

function exampleNames() {
    return _fs.readdirSync(sparqlFolder).map(function (fileName) {
        return fileName.slice(0, fileName.lastIndexOf('.'));
    });
}

function writeJrql(name, jrql) {
    _fs.writeFileSync(_path.join(dataFolder, name + '.json'), stringify(jrql), 'utf-8');
}

function readSparql(name) {
    var filePath = _path.join(sparqlFolder, name + '.sparql');
    if (_fs.existsSync(filePath)) {
        return _fs.readFileSync(filePath, 'utf-8');
    }
}

function readJrql(name) {
    var filePath = _path.join(dataFolder, name + '.json');
    if (_fs.existsSync(filePath)) {
        return JSON.parse(_fs.readFileSync(filePath, 'utf-8'));
    }
}

exports.forEachSparqlExample = function (test/*(name, sparql, jrql)*/) {
    _.each(exampleNames(), function (name) {
        var sparql = readSparql(name), jrql = readJrql(name);

        if (jrql) {
            test(name, sparql, jrql);
        } else if (!isTodo(name)) {
            console.warn('Not testing example %s', name);
        }
    });
};

function isTestCase(name) {
    return _fs.existsSync(_path.join(dataFolder, name + '.json'));
}

function readTodo() {
    return JSON.parse(_fs.readFileSync(_path.join(dataFolder, 'todo.json'), 'utf-8'));
}

function writeTodo(todo) {
    _fs.writeFileSync(_path.join(dataFolder, 'todo.json'), stringify(todo));
}

function isTodo(name) {
    return _.includes(readTodo(), name);
}

function rmTodo(name) {
    writeTodo(_.pull(readTodo(), name));
    console.log('%s removed from to todo list.', name);
}

function addTodo(name) {
    writeTodo(_.concat(readTodo(), name));
    console.log('%s added to todo list.', name);
}

function next(rl) {
    rl.question('Test case (or nothing for next): ', function (name) {
        if (!name) {
            // Find a test case that is not already tested or in the to-do folder
            name = _.find(exampleNames(), function (name) {
                return !isTestCase(name) && !isTodo(name);
            });
            if (!name) {
                console.error('No unconsidered test cases left!');
                next(rl);
            }
        }

        var sparql = readSparql(name);
        if (sparql) {
            console.log('Testing SPARQL %s:', name);
            console.log(sparql);

            _jrql.toJsonRql(sparql, function (err, jrql, parsed) {
                function done(err) {
                    if (err) {
                        console.error(err);
                        console.log(stringify(parsed));
                        addTodo(name);
                        next(rl);
                    } else if (isTestCase(name)) {
                        next(rl);
                    } else {
                        rl.question('Look OK? (y/n) ', function (answer) {
                            if (answer === 'y' || answer === 'yes') {
                                writeJrql(name, jrql);
                                console.log('Added to test folder.');
                                rmTodo(name);
                            } else {
                                console.log('Parsed:');
                                console.log(stringify(parsed));
                                addTodo(name);
                            }
                            next(rl);
                        });
                    }
                }
                if (err) {
                    done(err);
                } else {
                    console.log('json-rql:');
                    console.log(stringify(jrql));
                    _jrql.toSparql(jrql, done);
                }
            });
        } else {
            console.error(name + ' not found.');
            next(rl);
        }
    });
}

if (process.argv[1] === __filename) {
    next(readline.createInterface({ input: process.stdin, output: process.stdout }));
}