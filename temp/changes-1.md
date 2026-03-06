Apply these changes:

- lets go for a claude theme as it accompanies the tool: <https://tweakcn.com/themes/cmmf0iy9y000904l8232re8yc>
- go through every component on both and they tie up. For example the Exit wingman button has changed to be like the  exit session button! We want it the other way around, so change the
- the main Mission Control screen cards still look terrible so fous on their styline - for example the small bins should be a colour!
- ALSO - with first prompt message sent frmo UI, we need to send the context FIRST -- but only IF it is NOT blank! Our template should have some default info in it, such as:
"Ensure you load your claude.md"
Also add a templte that explains that we have access to a "/seshmem-load" gloabl user claude command. Call this template "Seshmem loader". The context for it is within the tool itself but you can add a section "extra seshmem load argume/gsdnts"
