import { DataFrame, RemoteSinkNode } from '@openhps/core';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSinkNode<In extends DataFrame> extends RemoteSinkNode<In, MQTTClient> {}
