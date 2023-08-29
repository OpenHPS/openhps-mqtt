import { expect } from 'chai';
import 'mocha';
import { ModelBuilder, Model, DataFrame, DataObject, CallbackSinkNode, CallbackSourceNode } from '@openhps/core';
import { MQTTClient, MQTTPushOptions, MQTTServer, MQTTSinkNode, MQTTSourceNode } from '../../../src';
import { Client, MqttClient, connect } from 'mqtt';

describe('node client', () => {
    describe('remote source', () => {

        it('should connect to a socket server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,           
                }))
                .from(new CallbackSourceNode(() => {
                    clientModel.emitAsync('destroy').then(() => {
                        return serverModel.emitAsync('destroy');
                    }).then(() => {
                        done();
                    });
                    return undefined;
                }))
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to()
                        .build().then(model => {
                            setTimeout(() => {
                                clientModel = model;
                                clientModel.pull();
                            }, 1000);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should connect to a websocket server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true
                }))
                .from(new CallbackSourceNode(() => {
                    clientModel.emit('destroy');
                    serverModel.emit('destroy');
                    done();
                    return undefined;
                }))
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'ws://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to()
                        .build().then(model => {
                            setTimeout(() => {
                                clientModel = model;
                                clientModel.pull();
                            }, 1000);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should support topic prefixes', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true,
                    prefix: 'openhps/model/'
                }))
                .from(new CallbackSourceNode(() => {
                    clientModel.emit('destroy');
                    serverModel.emit('destroy');
                    done();
                    return undefined;
                }))
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'ws://localhost:1443',
                            prefix: 'openhps/model/'
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to()
                        .build().then(model => {
                            setTimeout(() => {
                                clientModel = model;
                                clientModel.pull();
                            }, 1000);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should support custom topics', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true,
                }))
                .from(new CallbackSourceNode(() => {
                    return undefined;
                }))
                .to(new MQTTSinkNode({
                    uid: "sink",
                    push: { topic: 'openhps/scanner/00:11:22:33:44/ble' },
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'ws://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink",
                            push: { topic: 'openhps/scanner/+/ble' },
                        }))
                        .to(new CallbackSinkNode(frame => {
                            clientModel.emit('destroy');
                            serverModel.emit('destroy');
                            done();
                        }))
                        .build().then(model => {
                            setTimeout(() => {
                                clientModel = model;
                                serverModel.push(new DataFrame());
                            }, 1000);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should support custom deserializers', (done) => {
            let serverModel: Model<any, any>;
            let client: MqttClient;
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true,
                }))
                .from(new MQTTSourceNode({
                    uid: "sink",
                    push: { topic: 'openhps/scanner/+/ble', response: false },
                    deserialize: (data: any, options?: MQTTPushOptions) => {
                        console.log(data, options);
                        return new DataFrame();
                    }
                }))
                .to(new CallbackSinkNode(frame => {
                    serverModel.emit('destroy');
                    client.end();
                    done();
                }))
                .build().then(model => {
                    serverModel = model;
                    client = connect("ws://localhost:1443");
                    client.publish("openhps/scanner/00:11:22:33:44/ble", JSON.stringify({
                        timestamp: Date.now(),
                        address: "abc",
                        rssi: -10
                    }));
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should support non json data', (done) => {
            let serverModel: Model<any, any>;
            let client: MqttClient;
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true,
                }))
                .from(new MQTTSourceNode({
                    uid: "sink",
                    push: { topic: 'openhps/scanner/+/ble', response: false },
                    deserialize: (data: any, options?: MQTTPushOptions) => {
                        console.log(data, options);
                        return new DataFrame();
                    }
                }))
                .to(new CallbackSinkNode(frame => {
                    serverModel.emit('destroy');
                    client.end();
                    done();
                }))
                .build().then(model => {
                    serverModel = model;
                    client = connect("ws://localhost:1443");
                    client.publish("openhps/scanner/00:11:22:33:44/ble", Buffer.from("test"));
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should forward server pushes to the client', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode(frame => {
                            clientModel.emitAsync('destroy').then(() => {
                                return serverModel.emitAsync('destroy');
                            }).then(() => {
                                done();
                            });
                        }))
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            Promise.resolve(serverModel.push(frame));
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should forward client errors to the server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode(frame => {
                            throw new Error(`Client Error`);
                        }))
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            serverModel.once('error', err => {
                                clientModel.emitAsync('destroy').then(() => {
                                    return serverModel.emitAsync('destroy');
                                }).then(() => {
                                    done();
                                });
                            });
                            serverModel.push(frame);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);

        it('should forward client completed events to the server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode())
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            serverModel.push(frame);
                            serverModel.once('completed', event => {
                                // Completed locally
                                serverModel.once('completed', event => {
                                    // Completed on remote server
                                    clientModel.emitAsync('destroy').then(() => {
                                        return serverModel.emitAsync('destroy');
                                    }).then(() => {
                                        done();
                                    });
                                });
                            });
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);
        
    });
});