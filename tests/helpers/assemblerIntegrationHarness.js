const fs = require('fs');

function setupAssemblerIntegrationHarness(Assembler) {
  let assembler;
  let virtualFs;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    virtualFs = {};

    fs.existsSync.mockImplementation((filePath) => {
      return Object.prototype.hasOwnProperty.call(virtualFs, filePath);
    });

    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (!Object.prototype.hasOwnProperty.call(virtualFs, filePath)) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      const content = virtualFs[filePath];
      if (typeof content === 'string') {
        if (encoding === 'utf8' || encoding === 'utf-8') return content;
        return Buffer.from(content, 'utf8');
      }
      if (Buffer.isBuffer(content)) {
        return content;
      }
      throw new Error(`Unexpected content type for '${filePath}'`);
    });

    fs.writeFileSync.mockImplementation((filePath, data, options) => {
      if (Buffer.isBuffer(data)) {
        virtualFs[filePath] = data;
      } else if (typeof data === 'string') {
        if (options && options.encoding === 'utf8') {
          virtualFs[filePath] = data;
        } else {
          virtualFs[filePath] = Buffer.from(data, 'utf8');
        }
      } else {
        throw new Error(`Invalid data type in writeFileSync for '${filePath}'`);
      }
    });

    fs.openSync.mockImplementation((filePath, flags) => {
      if (flags === 'w') {
        virtualFs[filePath] = '';
      }
      return filePath;
    });

    fs.writeSync.mockImplementation((fd, buffer) => {
      if (!Object.prototype.hasOwnProperty.call(virtualFs, fd)) {
        throw new Error(`Invalid file descriptor: ${fd}`);
      }
      if (Buffer.isBuffer(buffer)) {
        virtualFs[fd] += buffer.toString('utf-8');
      } else if (typeof buffer === 'string') {
        virtualFs[fd] += buffer;
      } else {
        virtualFs[fd] += String(buffer);
      }
    });

    fs.closeSync.mockImplementation(() => {});

    assembler = new Assembler();
  });

  return {
    getAssembler: () => assembler,
    getVirtualFs: () => virtualFs,
  };
}

module.exports = { setupAssemblerIntegrationHarness };
