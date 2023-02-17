import { RemotePushOptions } from '@openhps/core';

export interface MQTTPushOptions extends RemotePushOptions {
    clientId: string;
    topic: string;
}
