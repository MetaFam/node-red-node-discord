import { Node, Red } from 'node-red';
import {
  IDeleteMessageResponse,
  IDeleteWrongMessageConfig,
  IMessageWithValidMessages,
} from '../lib/interfaces';

export = (RED: Red) => {
  RED.nodes.registerType('discord-delete-invalid-message', function(
    this: Node,
    props: IDeleteWrongMessageConfig,
  ) {
    RED.nodes.createNode(this, props);
    const node = this;
    // @ts-ignore
    this.on('input', (msg: IMessageWithValidMessages, send, done) => {
      node.status({ fill: 'green', shape: 'dot', text: 'ready' });
      const msgid = RED.util.generateId();

      const message: IDeleteMessageResponse = {
        _msgid: msgid,
        member: msg.member,
        memberRoleNames: msg.memberRoleNames,
        payload: '',
      };

      const messageReceived: string = msg.payload;
      const validMessageArray: string[] = msg.validMessages;
      let hasReceivedValidMessage = false;

      validMessageArray.forEach((validMessage) => {
        if (messageReceived.startsWith(validMessage)) {
          hasReceivedValidMessage = true;
        }
      });
      if (hasReceivedValidMessage) {
        message.payload = 'Valid message';
      } else {
        if (msg.rawData != null) {
          msg.rawData.delete();
        }
        message.payload = 'Invalid message';
      }
      node.send(message);
    });
  });
};
