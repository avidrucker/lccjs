// dockerController.js

const { execSync } = require('child_process');

class DockerController {
  constructor(containerName) {
    this.containerName = containerName;
    this.execSyncOptions = {
      stdio: 'ignore', // set to 'inherit' for verbose logging
      timeout: 20000, // 20 seconds
      maxBuffer: 1024 * 1024, // 1MB buffer limit
    };
  }

  execSyncWithLogging(command) {
    console.log(`Executing command: ${command}`);
    const startTime = Date.now();
    const result = execSync(command, this.execSyncOptions);
    const endTime = Date.now();
    console.log(`Command completed in ${endTime - startTime} ms`);
    return result;
  }

  containerExists() {
    try {
      execSync(`docker inspect ${this.containerName}`, { stdio: 'ignore' });
      return true;
    } catch (err) {
      return false;
    }
  }

  isContainerRunning() {
    try {
      const output = execSync(`docker inspect -f '{{.State.Running}}' ${this.containerName}`, { stdio: 'pipe' })
        .toString()
        .trim();
      return output === 'true';
    } catch (err) {
      return false;
    }
  }

  startContainer() {
    if (this.containerExists()) {
      if (!this.isContainerRunning()) {
        console.log(`Starting Docker container ${this.containerName}...`);
        this.execSyncWithLogging(`docker start ${this.containerName}`);
      } else {
        console.log(`Docker container ${this.containerName} is already running.`);
      }
    } else {
      console.log(`Creating and starting Docker container ${this.containerName}...`);
      this.execSyncWithLogging(`docker run --name ${this.containerName} --memory="512m" --cpus="1" -d ubuntu`);
    }
    this.waitForContainer();
  }

  stopContainer() {
    if (this.isContainerRunning()) {
      console.log(`Stopping Docker container ${this.containerName}...`);
      this.execSyncWithLogging(`docker stop ${this.containerName}`);
    } else {
      console.log(`Docker container ${this.containerName} is not running.`);
    }
  }

  waitForContainer(timeout = 20000) {
    const startTime = Date.now();
    while (true) {
      if (this.isContainerRunning()) {
        console.log(`Container ${this.containerName} is running.`);
        break;
      }
      if (Date.now() - startTime > timeout) {
        throw new Error(`Container ${this.containerName} did not start within ${timeout} ms.`);
      }
      execSync('sleep 1');
    }
  }
}

module.exports = DockerController;
