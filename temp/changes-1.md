plan these changes:

- lets go for a claude theme as it accompanies the tool: <https://tweakcn.com/themes/cmmf0iy9y000904l8232re8yc>
- go through every component on both and they tie up. For example the Exit wingman button has changed to be like the  exit session button! We want it the other way around, so change the
- the main Mission Control screen cards still look terrible so fous on their styline - for example the small bins should be a colour!
- ALSO - with first prompt message sent frmo UI, we need to send the context FIRST -- but only IF it is NOT blank! Our template should have some default info in it, such as:
"Ensure you load your claude.md"
Also add a templte that explains that we have access to a "/seshmem-load" gloabl user claude command. Call this template "Seshmem loader". The context for it is within the tool itself but you can add a section "extra seshmem load argume/gsdnts"
- I want to add support for some claude command line flags to the MC UI. Such as a tick box on the card for "YOLO mode" (defaultign off). If this is applied, we show a RED BANNER IN session to indicate we are living dangerously!
- as above but include a "With Chrome" checkbox. If this is applied, we show a icon/indicator in header to show we are using chrome!
- at the end of the tile, have the elipse button that wilkl open a "args  editor". This can be poulated initilaly by running a "claude --help" command and parsing the output. . For all args have a checkbox. For any arguement that has a "" it should habve a text box too And a save button, which will show "flags are set for that session". NOTE any flags (indlucing YOLO, and chrome slected for session  WILL be SAVED against the session)
- we have session history but no context history. i want to add support for this, weehreby we can lose the "Preview window" and make it obvoiously the "Context Editor" window (with a save button) and have a sesion list like the prompt UI
- a settings icon on mission control should open a modal that allows us to set the claude command line flags (later) but also the default destination dir for files (see below). This should be <project dir we are in>"/docs/promptfiles/".
- File support - if possible I would like inside the composer, to have a "add file" iconbtn. This will open a modal into which I can drag a file, or open file picker. When I add the file, we will get a file name ref (with project path included) whidh is copyable - so I can be typing a prompt And  say "see file " click the copy and then paste "for ref" andit apears as strign in the prompt.
