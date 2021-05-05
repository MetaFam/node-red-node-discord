import { Octokit } from "@octokit/rest";
import { IOctokit } from '@metafam/node-red-node-discord/src/lib/interfaces';

export class OctokitClient {
  private octokitClients: Map<string, IOctokit>;

  constructor() {
    this.octokitClients = new Map();
  }

  /**
   * Get octokitClient. Returns from Map if octokitClient already created.
   */
  public get(token: string): Promise<IOctokit> {
    return new Promise(async (resolve, reject) => {
      const fromMem = this.octokitClients.get(token);
      const octokitClient = fromMem || {
        numReferences: 0,
        octokit: new Octokit()
      } as IOctokit;
      octokitClient.numReferences = (octokitClient.numReferences || 0) + 1;
      if (fromMem) {
        resolve(fromMem);
      } else {
        let promisifyInstantiation = new Promise<void>((resolveInstantiation) => {
          octokitClient.octokit = new Octokit({auth: token});
          this.octokitClients.set(token, octokitClient);
          resolveInstantiation();
        })
        await promisifyInstantiation
          .then(() => resolve(octokitClient))
          .catch((err: Error) => reject(err));
      }
    });
  }

  /**
   * Destroy octokitClient connection
   */
  public destroy(octokitClient: IOctokit): void {
    if (octokitClient.numReferences === 0) {
      try {
        delete octokitClient.numReferences;
        delete octokitClient.octokit;
      } catch (e) {
        return;
      }
      for (const i of this.octokitClients.entries()) {
        if (i[1] === octokitClient) {
          this.octokitClients.delete(i[0]);
        }
      }
    }
  }
}
