const makeBuffer = (data, encoding) => {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (typeof data === 'string') {
    return Buffer.from(data, encoding || 'utf8');
  }

  return Buffer.from(String(data), 'utf8');
};

function installMockFileSystem(fs) {
  const state = { files: {} };

  fs.existsSync.mockImplementation((filePath) => {
    return Object.prototype.hasOwnProperty.call(state.files, filePath);
  });

  fs.readFileSync.mockImplementation((filePath, encoding) => {
    if (!Object.prototype.hasOwnProperty.call(state.files, filePath)) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }

    const content = state.files[filePath];

    if (typeof content === 'string') {
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return content;
      }

      return Buffer.from(content, 'utf8');
    }

    if (Buffer.isBuffer(content)) {
      return content;
    }

    throw new Error(`Unexpected content type for '${filePath}'`);
  });

  fs.writeFileSync.mockImplementation((filePath, data, encoding) => {
    if (Buffer.isBuffer(data)) {
      state.files[filePath] = data;
      return;
    }

    if (typeof data === 'string') {
      if (encoding === 'utf8' || encoding === 'utf-8') {
        state.files[filePath] = data;
      } else {
        state.files[filePath] = Buffer.from(data, 'utf8');
      }
      return;
    }

    state.files[filePath] = makeBuffer(data);
  });

  fs.openSync.mockImplementation((filePath, flags) => {
    if (flags === 'w') {
      state.files[filePath] = Buffer.alloc(0);
    }

    return filePath;
  });

  fs.writeSync.mockImplementation((fd, chunk) => {
    if (!Object.prototype.hasOwnProperty.call(state.files, fd)) {
      throw new Error(`Invalid file descriptor: ${fd}`);
    }

    const existing = state.files[fd];
    const existingBuffer = Buffer.isBuffer(existing) ? existing : Buffer.from(existing || '', 'utf8');
    state.files[fd] = Buffer.concat([existingBuffer, makeBuffer(chunk)]);
  });

  fs.closeSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});

  return state;
}

module.exports = {
  installMockFileSystem,
};
