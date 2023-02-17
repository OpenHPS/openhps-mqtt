import { DataFrame, RemoteSinkNode, RemoteSinkNodeOptions } from '@openhps/core';
import { MQTTNodeOptions } from '../MQTTNodeOptions';
import { MQTTClient } from '../../service/MQTTClient';
import { MQTTNode } from '../MQTTNode';

export class MQTTSinkNode<In extends DataFrame> extends RemoteSinkNode<In, MQTTClient> {
    constructor(options?: RemoteSinkNodeOptions<MQTTClient> & MQTTNodeOptions<MQTTClient>) {
        super({ service: MQTTClient, type: MQTTNode, ...options });
    }
}
