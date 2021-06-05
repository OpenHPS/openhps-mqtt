import { DataFrame, RemoteSourceNode } from '@openhps/core';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSourceNode<Out extends DataFrame> extends RemoteSourceNode<Out, MQTTClient> {}
