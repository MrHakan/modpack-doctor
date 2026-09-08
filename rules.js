window.MD_RULES = [
  {
    id:'mod-resolution', severity:'critical', title:'Mod dependency resolution failed', confidence:98,
    patterns:[/mod resolution encountered an incompatible mod set/i,/could not find required mod/i,/requires .*? but .*? is missing/i,/requires version .*? of .*?/i,/depends on .*? which is missing/i],
    description:'The loader cannot build a valid mod set. One or more dependencies are missing, incompatible, or on the wrong Minecraft/loader version.',
    fixes:['Read the exact dependency lines in the evidence below.','Install the required dependency version, or downgrade/upgrade the conflicting mod so all versions target the same Minecraft version and loader.','Do not mix Fabric-only, Forge-only, NeoForge-only, or Quilt-only builds unless the mod explicitly supports that environment.']
  },
  {
    id:'duplicate-mod', severity:'critical', title:'Duplicate mod detected', confidence:99,
    patterns:[/duplicate mod/i,/found duplicate mods/i,/multiple valid mod candidates/i,/more than one entry for mod id/i],
    description:'Two JARs appear to provide the same mod or mod ID. This often happens after updating a mod without deleting the old version.',
    fixes:['Open the instance mods folder and sort by name.','Keep only one version of the duplicated mod.','Check nested/mod-bundled JARs if the duplicate is not obvious.']
  },
  {
    id:'mixin', severity:'high', title:'Mixin transformation failed', confidence:92,
    patterns:[/mixin apply failed/i,/mixintransformererror/i,/invalidmixinexception/i,/injectionerror/i,/critical injection failure/i,/mixin.*failed injection check/i],
    description:'A mod tried to patch Minecraft or another mod at runtime and the target code did not match what it expected. Usually caused by an incompatible mod version or a direct mod conflict.',
    fixes:['Identify the first mod namespace in the failing mixin/class name. That mod is usually a stronger suspect than the final crash line.','Verify the mod is built for your exact Minecraft + loader version.','Temporarily remove or downgrade the suspect mod and test again.','If the error mentions another mod as the target, check compatibility notes between both mods.']
  },
  {
    id:'binary-incompat', severity:'high', title:'Binary mod incompatibility', confidence:91,
    patterns:[/nosuchmethoderror/i,/nosuchfielderror/i,/abstractmethoderror/i,/incompatibleclasschangeerror/i],
    description:'A mod is calling code that does not exist in the version currently loaded. This is a strong signal of mismatched mod/library versions.',
    fixes:['Inspect the class names around the first NoSuchMethod/Field/AbstractMethod error.','Update or downgrade the mod and its API/library dependency as a matched set.','Avoid mixing builds from nearby Minecraft versions even if the game launches.']
  },
  {
    id:'missing-class', severity:'high', title:'Missing class / library', confidence:86,
    patterns:[/noclassdeffounderror/i,/classnotfoundexception/i,/could not load class/i],
    description:'Something references a Java class that is not available. This can mean a missing dependency, wrong loader build, or a mod compiled against another version.',
    fixes:['Use the missing package/class name to identify which mod or library should provide it.','Check required dependencies on the suspect mod page.','Make sure all related API/library mods target the exact same Minecraft version.']
  },
  {
    id:'java-version', severity:'critical', title:'Java version mismatch', confidence:99,
    patterns:[/unsupportedclassversionerror/i,/has been compiled by a more recent version of the java runtime/i,/only recognizes class file versions up to/i,/requires java (?:version )?\d+/i],
    description:'The selected Java runtime cannot execute one or more classes in this pack.',
    fixes:['Use the Java version expected by your Minecraft version and loader.','In PrismLauncher/MultiMC, set Java per instance instead of relying on the system default.','If one mod alone requires a newer Java than the pack, verify that mod build actually targets your Minecraft version.']
  },
  {
    id:'oom', severity:'critical', title:'Out of memory', confidence:100,
    patterns:[/outofmemoryerror/i,/java heap space/i,/gc overhead limit exceeded/i,/unable to create native thread/i],
    description:'Minecraft or Java exhausted available heap/native memory.',
    fixes:['Increase allocated RAM moderately, not blindly. Large packs commonly need more than vanilla.','Close memory-heavy background applications.','If RAM usage grows continuously, suspect a memory leak or runaway resource/mod interaction.','Do not allocate nearly all system RAM to Minecraft; leave headroom for the OS and GPU drivers.']
  },
  {
    id:'stack-overflow', severity:'high', title:'Stack overflow / recursive crash', confidence:96,
    patterns:[/stackoverflowerror/i],
    description:'A function appears to be recursing until Java runs out of stack space. This is commonly a mod logic conflict rather than insufficient RAM.',
    fixes:['Find repeating stack frames directly above the StackOverflowError.','The repeated mod namespace is a strong suspect.','Update/remove the suspect mod or conflicting integration before changing JVM memory flags.']
  },
  {
    id:'config', severity:'high', title:'Broken or incompatible configuration', confidence:88,
    patterns:[/failed to load config/i,/config.*parse/i,/toml.*parse/i,/jsonparseexception/i,/malformedjsonexception/i,/expected .* at line \d+ column \d+/i,/could not parse.*config/i],
    description:'A configuration file could not be parsed or no longer matches the mod version.',
    fixes:['Back up the config file named near the error.','Rename/delete only that config so the mod can regenerate defaults.','If the config was carried across a major mod update, compare it against the new default format.']
  },
  {
    id:'access', severity:'high', title:'Access widener / transformer failure', confidence:90,
    patterns:[/accesswidener/i,/access widener/i,/accesstransformer/i,/access transformer/i],
    description:'A loader-specific access patch could not be applied, usually because a mod targets different mappings, loader, or Minecraft version.',
    fixes:['Verify the suspect mod is for the correct loader.','Check that Fabric API / Forge / NeoForge versions match the pack.','Replace the suspect mod with the exact build for your Minecraft version.']
  },
  {
    id:'native-crash', severity:'critical', title:'Native JVM / driver crash', confidence:90,
    patterns:[/exception_access_violation/i,/sigsegv/i,/a fatal error has been detected by the java runtime environment/i,/problematic frame:/i],
    description:'The Java process crashed outside ordinary Java exception handling. GPU drivers, native libraries, overlays, or hardware instability can be involved.',
    fixes:['Check the “Problematic frame” line for a GPU driver DLL/SO, LWJGL, or native library.','Update GPU drivers and disable overlays/injectors temporarily.','Undo aggressive GPU/CPU/RAM overclocks while testing.','If the problematic frame belongs to a mod native library, update or remove that mod first.']
  },
  {
    id:'opengl', severity:'high', title:'OpenGL / graphics capability failure', confidence:91,
    patterns:[/opengl.*error/i,/glfw error/i,/failed to create window/i,/pixel format not accelerated/i,/opengl version/i,/renderer.*unsupported/i],
    description:'Minecraft could not initialize or use the graphics stack correctly.',
    fixes:['Install/update the GPU driver from NVIDIA/AMD/Intel rather than relying only on Windows Update.','On laptops, ensure Minecraft is using the intended GPU.','Remove graphics injectors/shader compatibility layers while testing.','Check whether the Minecraft version requires a newer OpenGL capability than the GPU supports.']
  },
  {
    id:'lwjgl', severity:'high', title:'LWJGL / native library problem', confidence:88,
    patterns:[/lwjgl/i,/unsatisfiedlinkerror/i,/failed to load native library/i,/no .* in java\.library\.path/i],
    description:'A native library used by Minecraft could not be loaded or initialized.',
    fixes:['Try a clean launcher runtime/native download.','Check antivirus quarantine and filesystem permissions.','Avoid copying launcher libraries manually between instances.']
  },
  {
    id:'concurrent', severity:'medium', title:'Concurrent modification / threading issue', confidence:75,
    patterns:[/concurrentmodificationexception/i,/illegalstateexception:.*already/i],
    description:'A collection or game state was changed while another operation was iterating it. The responsible mod is usually identified by nearby stack frames.',
    fixes:['Look for the first non-Minecraft/non-Java namespace in the stack trace.','Update the suspect mod and integrations.','If reproducible only with two specific mods, report the interaction to their maintainers with this evidence.']
  },
  {
    id:'resource', severity:'medium', title:'Resource / datapack parsing failure', confidence:80,
    patterns:[/failed to parse resource/i,/error loading resource/i,/datapack.*failed/i,/couldn't parse data file/i,/failed to load datapacks/i],
    description:'A resource, datapack, recipe, tag, or asset failed to load.',
    fixes:['Identify the namespace/path in the evidence.','Disable the related resource pack/datapack or update the providing mod.','If the pack was manually edited, validate the referenced JSON.']
  },
  {
    id:'exit-code-only', severity:'low', title:'Exit code detected, but it is not the root cause', confidence:100,
    patterns:[/process exited with code 1/i,/exit code:? ?1/i,/process crashed with exitcode/i],
    description:'Launcher exit codes only confirm that the process failed. The useful cause is normally earlier in the log.',
    fixes:['Scroll upward to the first ERROR, Caused by, Exception, mixin failure, or mod-resolution message.','Provide latest.log or the crash report if this is the only diagnostic found.']
  }
];
