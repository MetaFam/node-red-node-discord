import { NodeProperties, Red } from 'node-red';

import { IGithubConnectConfig } from '@metafam/node-red-node-discord/src/lib/interfaces';

export = (RED: Red) => {
  RED.nodes.registerType(
    'github-token',
    function(this: IGithubConnectConfig, props: NodeProperties): void {
      RED.nodes.createNode(this, props);
      this.discordToken = this.credentials.discordToken;
      this.githubPersonalAccessToken = this.credentials.githubPersonalAccessToken;
      this.githubUsername = this.credentials.githubUsername;
      this.name = props.name;
    },
    {
      credentials: {
        discordToken: { type: 'password', required:true },
        githubPersonalAccessToken: { type: 'password', required:true },
        githubUsername: { type: 'text', required:true },
      },
    },
  );
};
