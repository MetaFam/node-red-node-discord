import { Message, MessageAttachment } from 'discord.js';
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
const fs = require('fs');
import axios from 'axios';

const IMAGE_REPO_NAME = "metagame-wiki";
const IMAGE_REPO_BRANCH = "imageBranch";
const download_image = (url: string, image_path: string) =>
  axios({
    url,
    responseType: 'stream',
  }).then(
    response =>
      new Promise<void>((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', (e: Error) => reject(e));
      }),
  );


export = (RED: Red) => {
  RED.nodes.registerType('discord-create-pull-request', function(
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
                  if (msg.content.match(/create pr(.*?)/g)) {
          
                      // create a pull request for an image
          
                      let attachmentsMap = msg.attachments;
                      if(attachmentsMap.size < 1) {
                          node.error(`Github Pull Request creation failed ! No image has been attached !`)
                          msg.reply(`Github Pull Request creation failed ! No image has been attached !`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                          return;
                      }
          
                      // check if IMAGE_REPO_BRANCH exists
          
                      let revisionHashes = await octokitClient.request('GET /repos/{owner}/{repo}/git/refs/heads', {
                          owner: githubUsername,
                          repo: IMAGE_REPO_NAME
                        }).catch((error) => {
                          node.error('Encountered error : ' + error);
                          msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                          return;
                      })
          
                      if(revisionHashes && revisionHashes.data && !revisionHashes.data.find((obj: any) => obj.ref == `refs/heads/${IMAGE_REPO_BRANCH}`)) {
          
                          // IMAGE_REPO_BRANCH not found, creating IMAGE_REPO_BRANCH
                          node.send({payload: `${IMAGE_REPO_BRANCH} not found, creating ${IMAGE_REPO_BRANCH}`})
          
                          // SHA1 hash of the master branch
          
                          let revisionHash = revisionHashes.data.find((ref: any) => ref.ref == 'refs/heads/master').object.sha; 
          
                          // creating IMAGE_REPO_BRANCH
                          
                          await octokitClient.request('POST /repos/{owner}/{repo}/git/refs', {
                              owner: githubUsername,
                              repo: IMAGE_REPO_NAME,
                              ref: `refs/heads/${IMAGE_REPO_BRANCH}`,
                              sha: revisionHash
                          }).catch((error) => {
                              node.error('Encountered error : ' + error);
                              msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                              return;
                          })
                      }
          
                      // going through all attachments
                      
                      for(let i=0; i<attachmentsMap.size; i++) {
                          let attachment = attachmentsMap.get(attachmentsMap.keys().next().value) as MessageAttachment;
                          if(attachment) {
                            let fileURL = attachment.url;
                            let filename = attachment.filename;
                            
                            // downloading image from url and saving it
            
                            await download_image(fileURL, `${filename}`).then(async () => {
                                
                                // read image file as base64
            
                                const data = fs.readFileSync(`${filename}`,{encoding: 'base64'});
            
                                // find blob sha hash of the file, required if we are updating
            
                                let blob = await octokitClient.request('POST /repos/{owner}/{repo}/git/blobs', {
                                    owner: githubUsername,
                                    repo: IMAGE_REPO_NAME,
                                    content: data,
                                    encoding: "base64"
                                }).catch((error) => {
                                    node.error('Encountered error : ' + error);
                                    msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                                    return;
                                })
            
                                if(blob) {
                                  let shaHash = blob.data.sha;
            
                                  // create commit on IMAGE_REPO_BRANCH with image file 
              
                                  await octokitClient.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                                      owner: githubUsername,
                                      repo: IMAGE_REPO_NAME,
                                      branch: IMAGE_REPO_BRANCH,
                                      path: `static/img/${filename}`,
                                      message: `add image ${filename}`,
                                      sha: shaHash,
                                      content: data
                                  }).catch((error) => {
                                      node.error('Encountered error : ' + error);
                                      msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                                      return;
                                  })
              
                                  // create a pull request
                                  
                                  await octokitClient.rest.pulls.create({
                                      owner: githubUsername,
                                      repo: IMAGE_REPO_NAME,
                                      title: `add image ${filename}`,
                                      head: IMAGE_REPO_BRANCH,
                                      base: "master"
                                  }).then(()=> {
                                      node.send({payload: `Github Pull Request creation succeeded !`})
                                      msg.reply(`Github Pull Request creation succeeded !`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                                  }).catch((error) => {
                                      node.error('Encountered error : ' + error);
                                      msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                                      return;
                                  })

                                  fs.unlinkSync(`${filename}`);
                                }
            
                            }).catch((error) => {
                                node.error("Encountered error : " + error);
                                msg.reply(`Github Pull Request creation failed ! Encountered error : ${error}`).catch((err: Error) => {node.error('Encountered error : ' + err);});
                            })
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
