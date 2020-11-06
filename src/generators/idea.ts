import path from 'path';
import fse from 'fs-extra';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const content = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectTasksOptions">
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="ts" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.ts)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="tsx" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.tsx)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="js" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.js)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="json" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.json)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="md" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.md)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
    <TaskOptions isEnabled="true">
      <option name="arguments" value="prettier --write $FilePathRelativeToProjectRoot$" />
      <option name="checkSyntaxErrors" value="false" />
      <option name="description" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="html" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Prettier (.html)" />
      <option name="output" value="$FilePathRelativeToProjectRoot$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="yarn" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="false" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
  </component>
</project>
`;

export async function generateIdeaSettings(config: PackageConfig): Promise<void> {
  const dirPath = path.resolve(config.dirPath, '.idea');
  if (fse.existsSync(dirPath)) {
    const filePath = path.resolve(dirPath, 'watcherTasks.xml');
    if (
      config.containingJavaScript ||
      config.containingJavaScriptInPackages ||
      config.containingTypeScript ||
      config.containingTypeScriptInPackages ||
      (config.containingPackageJson &&
        !config.containingPubspecYaml &&
        !config.containingGemfile &&
        !config.containingGoMod &&
        !config.containingPomXml)
    ) {
      await FsUtil.generateFile(filePath, content);
    } else {
      await fse.remove(filePath);
    }
  }
}
