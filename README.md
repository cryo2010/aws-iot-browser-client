# aws-iot-browser-client

An AWS IoT browser client that uses an mqtt websocket connection.


## Example
```javascript
  const client = new AwsIotBrowserClient({
    clientId: 'unique-id',
    iotEndpoint: process.env.REACT_APP_IOT_ENDPOINT || '',
    cognitoIdentityPoolId: process.env.REACT_APP_AWS_COGNITO_IDENTITY_POOL_ID || '',
    region: process.env.REACT_APP_AWS_REGION || '',
  });

  client.onConnect(() => {
    client.subscribe('example-topic');
  });

  client.onMessage((topic: string, payload: Object) => {
    console.info('received message');
  });
```
