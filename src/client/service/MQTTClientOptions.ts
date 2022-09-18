import { IClientOptions } from 'mqtt';
import { QoS } from 'mqtt-packet';

export interface MQTTClientOptions extends IClientOptions {
    url: string;
    /**
     * Quality of Service for published messages
     */
    qos?: QoS;
}
