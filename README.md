<h1 align="center">
  <img alt="OpenHPS" src="https://openhps.org/images/logo_text-512.png" width="40%" /><br />
  @openhps/mqtt
</h1>
<p align="center">
    <a href="https://github.com/OpenHPS/openhps-mqtt/actions/workflows/main.yml" target="_blank">
        <img alt="Build Status" src="https://github.com/OpenHPS/openhps-mqtt/actions/workflows/main.yml/badge.svg">
    </a>
    <a href="https://codecov.io/gh/OpenHPS/openhps-mqtt">
        <img src="https://codecov.io/gh/OpenHPS/openhps-mqtt/branch/master/graph/badge.svg"/>
    </a>
    <a href="https://codeclimate.com/github/OpenHPS/openhps-mqtt/" target="_blank">
        <img alt="Maintainability" src="https://img.shields.io/codeclimate/maintainability/OpenHPS/openhps-mqtt">
    </a>
    <a href="https://badge.fury.io/js/@openhps%2Fmqtt">
        <img src="https://badge.fury.io/js/@openhps%2Fmqtt.svg" alt="npm version" height="18">
    </a>
</p>

<h3 align="center">
    <a href="https://github.com/OpenHPS/openhps-core">@openhps/core</a> &mdash; <a href="https://openhps.org/docs/mqtt">API</a>
</h3>

<br />

## Getting Started
If you have [npm installed](https://www.npmjs.com/get-npm), start using @openhps/mqtt with the following command.
```bash
npm install @openhps/mqtt --save
```

## Usage
The MQTT module uses a broker for all communication. You can use the embedded MQTT server or use an external broker.

### Embedded MQTT Server
Using the embedded MQTT server will use [Aedes](https://github.com/moscajs/aedes) as the broker. For more production
ready deployments using a dedicated broker is recommended.
```typescript
ModelBuilder.create()
    .addService(new MQTTServer({
        port: 1443          // MQTT port
    }))
    .from(new MQTTSourceNode({
        uid: "source"
    }))
    .to()
    .build();
```

### Client Example
```typescript
ModelBuilder.create()
    .addService(new MQTTClient({
        url: "mqtt://localhost:1443",
    }))
    .from(/* ... */)
    .to(new MQTTSinkNode({
        uid: "source"
    }))
    .build();
```

### External MQTT Server
You can set up multiple clients connecting to an external MQTT server.
The API is exactly the same as the client example.

## Protocol

|**Topic**|**Description**|
|-|-|
|\<uid\>/push|Topic to push to a node with a certain \<uid\>|
|\<uid\>/pull|Topic to pull from a node with a certain \<uid\>|
|\<uid\>/events/error|Topic to publish errors to a node with a certain \<uid\>|
|\<uid\>/events/completed|Topic to publish completed event to a node with a certain \<uid\>|

**Note:** A prefix an be added to the topics in case the broker is used for multiple positioning systems.
### Push Payload
```json
{
    "frame": {
        // ...
    },
    "options": {
        // ...
    }
}
```

### Pull Payload
```json
{
    "options": {
        // ...
    }
}
```

### Event Payload
```json
{
    // ...
}
```

### Browser Usage
The following compiled files are provided for browser usage:
- openhps-mqtt.js: CJS version. Requires (openhps-core.js in same directory)
- openhps-mqtt.min.js: Minified CJS version. Requires (openhps-core.min.js in same directory)
- openhps-mqtt.es.js: ESM version. Requires (openhps-core.es.js in same directory)
- openhps-mqtt.es.min.js: Minified ESM version. Requires (openhps-core.es.min.js in same directory)

## Contributors
The framework is open source and is mainly developed by PhD Student Maxim Van de Wynckel as part of his research towards *Hybrid Positioning and Implicit Human-Computer Interaction* under the supervision of Prof. Dr. Beat Signer.

## Contributing
Use of OpenHPS, contributions and feedback is highly appreciated. Please read our [contributing guidelines](CONTRIBUTING.md) for more information.

## License
Copyright (C) 2019-2024 Maxim Van de Wynckel & Vrije Universiteit Brussel

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.