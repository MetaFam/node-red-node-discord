import { Message } from 'discord.js';
import { Node, Red } from 'node-red';
import { Bot } from '../lib/Bot';
import { OctokitClient } from '../lib/OctokitClient';
import {
  IBot,
  IOctokit,
  ICallback,
  IGithubConnectConfig,
  IDiscordChannelConfig,
  NamedChannel,
} from '../lib/interfaces';

export = (RED: Red) => {
  RED.nodes.registerType('discord-create-issue', function(
    this: Node,
    props: IDiscordChannelConfig,
  ) {
    RED.nodes.createNode(this, props);
    const configNode = RED.nodes.getNode(props.token) as IGithubConnectConfig;
    const { discordToken, githubPersonalAccessToken, githubUsername } = configNode;
    const node = this;
    const botInstance = new Bot();
    const octokitClientInstance = new OctokitClient();
    const rawChannels = props.channels;
    const channels =
      rawChannels.length > 0
        ? rawChannels
            .split('#')
            .map((e: string) => e.trim())
            .filter((e: string) => e !== '')
        : [];
    if (discordToken && githubPersonalAccessToken && githubUsername) {
      botInstance
        .get(discordToken)
        .then((bot: IBot) => {
          octokitClientInstance.get(githubPersonalAccessToken).then((octokitInterface: IOctokit) => {
            const octokitClient = octokitInterface.octokit;
            const callbacks: ICallback[] = [];
            node.status({ fill: 'green', shape: 'dot', text: 'ready' });

            const registerCallback = (
              event: string,
              listener: (param: any) => void,
            ) => {
              callbacks.push({ event, listener });
              bot.on(event, listener);
            };
            registerCallback('message', async (msg: Message) => {
              let processingAllowed = !!!channels.length;
              if (!processingAllowed) {
                if (msg.channel.type.trim() !== 'dm') {
                  const channel = msg.channel as NamedChannel;
                  if (
                    !channels.includes(channel.name) &&
                    !channels.includes(channel.id)
                  ) {
                    processingAllowed = false;
                  } else {
                    processingAllowed = true;
                  }
                }
              }
              if (msg.author !== bot.user && processingAllowed) {
                try {
                  if (msg.content.match(/issuize to repo(.*?)/g)) {
          
                      // create an issue for a repo
          
                      if(msg.content.split("|").length < 3) {
                          node.error(`Github issue creation failed ! The message must be of the format : "issuize to repo X | issue title | issue body"`)
                          msg.reply(`Github issue creation failed ! The message must be of the format : "issuize to repo X | issue title | issue body"`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                          return;
                      }
                      let repoName = msg.content.split("issuize to repo")[1].split("|")[0].trim();
                      let githubIssueTitle = msg.content.split("|")[1].trim();
                      let githubIssueBody = msg.content.split("|")[2].trim();
                      if(!repoName || repoName.length === 0 ) {
                          node.error(`Github issue creation failed ! Repo Name is empty or null or undefined`)
                          msg.reply(`Github issue creation failed ! Repo Name is empty or null or undefined`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                          return;
                      }
                      else {
                          // check if repo name is valid according to gihub's naming conventions
                          if(repoName.match(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i)) {
                              let repoOwner = githubUsername;
                              await octokitClient.rest.issues.create({
                                  owner: repoOwner,
                                  repo: repoName,
                                  title: githubIssueTitle,
                                  body: githubIssueBody
                                  }).then(() => {
                                      node.send({payload: 'Github issue creation succeded !'})
                                      msg.reply('Github issue creation succeded !').catch((err: Error) => {node.error('Encountered error : ' + err);});
                                  }).catch(err => {
                                      msg.reply(`Github issue creation failed ! Encountered error : ${err}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                                      return;
                                  })
                          }
                          else {
                              node.error('Github issue creation failed ! Repo Name is not valid !')
                              msg.reply('Github issue creation failed ! Repo Name is not valid !').catch((err: Error) => {node.error('Encountered error : ' + err);});
                              return;
                          }
                      }
                  }
              } catch (error) {
                  node.error("Encountered error : " + error);
                  msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
              }
              }
            });
            registerCallback('error', (error: Error) => {
              node.error(error);
              node.status({ fill: 'red', shape: 'dot', text: 'error' });
            });
            node.on('close', () => {
              callbacks.forEach((callback: ICallback) => {
                bot.removeListener(callback.event, callback.listener);
              });
              botInstance.destroy(bot);
            });
          })
        })
        .catch((err: Error) => {
          node.error(err);
          node.send(configNode);
          node.status({ fill: 'red', shape: 'dot', text: 'wrong token?' });
        });
    } else {
      this.error('Access token not specified');
    }
  });
};
