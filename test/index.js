/*
* Copyright (c) 2013, Yahoo! Inc. All rights reserved.
* Copyrights licensed under the New BSD License.
* See the accompanying LICENSE file for terms.
*/

var os = require('os'),
    vows = require('vows'),
    assert = require('assert'),
    bl = require('bl'),
    mod_status = require('../lib/index.js'),
    rightnow = new Date();

var mockResponse = { '20799':
    {
        last: {
            cluster: 20799,
            title: '/home/y/libexec/node',
            pid: 20799,
            cpu: 0,
            user_cpu: 0,
            sys_cpu: 0,
            cpuperreq: 0,
            jiffyperreq: 0,
            events: 0.03225806451612906,
            elapsed: 151001.72,
            ts: 1337011626,
            mem: 0.57,
            reqstotal: 100,
            rps: 20,
            oreqs: 10,
            utcstart: 1337010906,
            oconns: 0,
            kb_trans: 0,
            kbs_out: 0
        },
        kill: false,
        curr: {
            cluster: 20799,
            title: '/home/y/libexec/node',
            pid: 20799,
            cpu: 0,
            user_cpu: 0,
            sys_cpu: 0,
            cpuperreq: 0,
            jiffyperreq: 0,
            events: 0,
            elapsed: 0.01,
            ts: 1337011841,
            mem: 0.55,
            reqstotal: 100,
            rps: 20,
            oreqs: 2,
            utcstart: 1337010906,
            oconns: 0,
            kb_trans: 150,
            kbs_out: 100
        }
    }, '22760':
    {
        last: {
            cluster: 22760,
            title: '/home/y/libexec/node',
            pid: 22760,
            cpu: 6.252776074688882e-13,
            user_cpu: 5.5,
            sys_cpu: 0,
            cpuperreq: 0,
            jiffyperreq: 0,
            events: 0.12903225806610408,
            elapsed: 0,
            ts: 1337011798.44,
            mem: 0,
            reqstotal: 0,
            rps: 0,
            oreqs: 0,
            utcstart: 1337011798,
            oconns: 0,
            kb_trans: 0,
            kbs_out: 0
        },
        kill: false,
        curr: {
            cluster: 22760,
            title: '/home/y/libexec/node',
            pid: 22760,
            cpu: 0,
            user_cpu: 0,
            sys_cpu: 0,
            cpuperreq: 0,
            jiffyperreq: 0,
            events: 0,
            elapsed: 0.01,
            ts: 1337011841.45,
            mem: 0.59,
            reqstotal: 50,
            rps: 5,
            oreqs: 2,
            utcstart: 1337011798,
            oconns: 1,
            kb_trans: 500,
            kbs_out: 125
        }
    }};
    // mock net
var netMock =  {
    createConnection : function (socketPath) {
        var socket;

        // create a stream that'll pass on a Buffer
        socket = bl(new Buffer(JSON.stringify(mockResponse)));

        // faux errors from the stream for testing
        if (socketPath === 'error.sock') {
            process.nextTick(socket.emit.bind(socket, "error", new Error("err")));
        } else if (socketPath === 'error.on.close.sock') {
            process.nextTick(socket.emit.bind(socket, "close", new Error("err")));
        }

        return socket;
    }
};

require('net').createConnection = netMock.createConnection;

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err + ' : ' + err.stack);
});

var tests = {
    'loading': {
        topic: function () {
            return mod_status;
        },
        'should be a function': function (topic) {
            assert.isFunction(topic);
        },
        'and should return': {
            topic: function () {
                return mod_status();
            },
            'a function': function (topic) {
                assert.isFunction(topic);
            }
        }
    },
    'should go to next by default': {
        topic: function () {
            var fn = mod_status(),
                next = false;
            fn({
                url: '/foo'
            }, {}, function () {
                next = true;
            });
            return next;
        },
        'should be true': function (topic) {
            assert.isTrue(topic);
        }
    },
    'should send good json response': {
        topic: function () {
            var fn = mod_status({responseContentType : 'json'}),
                code = null,
                next = false,
                text = null,
                self = this;

            process.clusterStartTime = rightnow;
            fn({
                url: '/status'
            }, {
                writeHead: function (c) {
                    code = c;
                },
                end: function (d) {
                    text = JSON.parse(d);
                    self.callback(null, {
                        code: code,
                        text: text,
                        next: next
                    });
                }
            }, function () {
                next = true;
            });
        },
        'next should be false': function (topic) {
            assert.isFalse(topic.next);
        },
        'json object returned should have valid values': function (topic) {
            var pid, i;
            assert.equal(topic.text.hostname, os.hostname());
            assert.equal(topic.text.total_requests, mockResponse['20799'].curr.reqstotal + mockResponse['22760'].curr.reqstotal);
            assert.equal(topic.text.total_kbs_out, mockResponse['20799'].curr.kbs_out + mockResponse['22760'].curr.kbs_out);
            assert.equal(topic.text.total_kbs_transferred, mockResponse['20799'].curr.kb_trans + mockResponse['22760'].curr.kb_trans);
            assert.equal(topic.text.total_rps, mockResponse['20799'].curr.rps + mockResponse['22760'].curr.rps);
            assert.equal(topic.text.worker.length, 2);
            for (i = 0; i < 2; i++) {
                pid = topic.text.worker[i].pid;
                assert.equal(topic.text.worker[i].cpu, mockResponse[pid].curr.cpu);
                assert.equal(topic.text.worker[i].mem, mockResponse[pid].curr.mem);
                assert.equal(topic.text.worker[i].cpu_per_req, mockResponse[pid].curr.cpuperreq);
                assert.equal(topic.text.worker[i].jiffy_per_req, mockResponse[pid].curr.jiffyperreq);
                assert.equal(topic.text.worker[i].rps, mockResponse[pid].curr.rps);
                assert.equal(topic.text.worker[i].events, mockResponse[pid].curr.events);
                assert.equal(topic.text.worker[i].open_conns, mockResponse[pid].curr.oconns);
                assert.equal(topic.text.worker[i].open_requests, mockResponse[pid].curr.oreqs);
                assert.equal(topic.text.worker[i].total_requests, mockResponse[pid].curr.reqstotal);
                assert.equal(topic.text.worker[i].kbs_out, mockResponse[pid].curr.kbs_out);
                assert.equal(topic.text.worker[i].kbs_transferred, mockResponse[pid].curr.kb_trans);
                assert.equal(topic.text.worker[i].start_time, mockResponse[pid].curr.utcstart * 1000);
            }
            assert.equal(topic.text.hostname, os.hostname());
            assert.equal(topic.text.node_version, process.version);
            assert.equal(topic.text.os_type, os.type());
            assert.equal(topic.text.os_release, os.release());
            assert.equal(topic.text.cluster_start_time, rightnow.getTime());
        },
        'code should be 200': function (topic) {
            assert.equal(topic.code, 200);
        }
    },
    'should send bad response if check config returns false': {
        topic: function () {
            var fn = mod_status({
                    check: function () { return false; }
                }),
                code = null,
                next = false,
                text = null;

            fn({
                url: '/status'
            }, {
                writeHead: function (c) {
                    code = c;
                },
                end: function (d) {
                    text = d;
                }
            }, function () {
                next = true;
            });
            return {
                code: code,
                text: text,
                next: next
            };
        },
        'next should be false': function (topic) {
            assert.isFalse(topic.next);
        },
        'data should be Not Found': function (topic) {
            assert.equal(topic.text, 'Not Found');
        },
        'code should be 404': function (topic) {
            assert.equal(topic.code, 404);
        }
    },
    'should send bad response on socket error': {
        topic: function () {
            var fn = mod_status({
                    socketPath : 'error.sock'
                }),
                code = null,
                next = false,
                text = null,
                self = this;

            fn({
                url: '/status'
            }, {
                writeHead: function (c) {
                    code = c;
                },
                end: function (d) {
                    text = d;
                    self.callback(null, {
                        code: code,
                        text: text,
                        next: next
                    });
                }
            }, function () {
                next = true;
            });
        },
        'next should be false': function (topic) {
            assert.isFalse(topic.next);
        },
        'data should be Watcher is not running': function (topic) {
            assert.equal(topic.text, 'Watcher is not running');
        },
        'code should be 500': function (topic) {
            assert.equal(topic.code, 500);
        }
    },
    'should send bad response on socket errors out on close': {
        topic: function () {
            var fn = mod_status({
                    socketPath : 'error.on.close.sock'
                }),
                code = null,
                next = false,
                text = null,
                self = this;

            fn({
                url: '/status'
            }, {
                writeHead: function (c) {
                    code = c;
                },
                end: function (d) {
                    text = d;
                    self.callback(null, {
                        code: code,
                        text: text,
                        next: next
                    });
                }
            }, function () {
                next = true;
            });
        },
        'next should be false': function (topic) {
            assert.isFalse(topic.next);
        },
        'data should be Watcher is not running': function (topic) {
            assert.equal(topic.text, 'Watcher is not running');
        },
        'code should be 500': function (topic) {
            assert.equal(topic.code, 500);
        }
    },
    'should send good html response if responseContentType is something but not json': {
        topic: function () {
            var fn = mod_status({responseContentType : 'xyz'}),
                code = null,
                next = false,
                text = null,
                self = this;

            process.clusterStartTime = rightnow;
            fn({
                url: '/status'
            }, {
                writeHead: function (c) {
                    code = c;
                },
                end: function (d) {
                    text = d;
                    self.callback(null, {
                        code: code,
                        text: text,
                        next: next
                    });
                }
            }, function () {
                next = true;
            });
        },
        'next should be false': function (topic) {
            assert.isFalse(topic.next);
        },
        'text should be html': function (topic) {
            assert.ok(topic.text.indexOf('html') !== -1);
        },
        'code should be 200': function (topic) {
            assert.equal(topic.code, 200);
        }
    }
};

vows.describe('mod_status').addBatch(tests)['export'](module);
