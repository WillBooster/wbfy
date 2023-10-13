class Options {
  isVerbose: boolean;
  doesUploadEnvVars: boolean;

  constructor() {
    this.isVerbose = false;
    this.doesUploadEnvVars = false;
  }
}

export const options = new Options();
