If I were to present my hackathon main project, and kind of indicate that I've done another mini project within it called Wingman. The objective of this wingman project would be to show that I was showing my initiative in creating a tool that would speed up the prompting process. This is obvious for integration ,as I've discussed ,with Claude Code To simplify our command line prompting mechanism, But also I feel it could assist us with cursor. What I mean by this is that the chat window inside cursor Is a bit small therefore we could have a similar mechanism whereby I could just type in CRC and CRP to To achieve the same things as with Cursor, with support for claude code (CC) also!

Here is a possible sequential idea for our application. It is important for the user of this wingman utility, to understand that the context we are dealing with is chat context as opposed to app wide context. Whereby for each new chat we can specify context and then move on to our window that will facilitate our prompt flow saving previous prompts we have Used, by using the "trigger commands" for example "CCC" or "CCP" etc

## PROJECT FOLDER
On startup we ask for the working directory where our intended coding project resides - And specify to choose the root of the project. 

At this point our app will look for a wingman directory in the root . Should it be there there should be a config file (wingcfg.json?), possibly in the format of a JSON file which will give our wingman app context on how it should operate . In this wingman directory we will also have support for templates. For now this will just be for context (for all tools whether cursor or CC), for example a context_template.md. This config file might include the name of the app already which we will use throughout the rest of the experience when referring to “ do you want me to generate X for  <appname>" To personalise the experience.  If there is no wingman directory in the location, We will then prompt for an app name, and create the template context file. At this point the user will still have the opportunity to edit the app name and we will subsequently save it to the config file and for the rest of our session, until they click next to get onto the next page of our app.

## ENVIRONMENT
The next page will be a page to determine their environment, with some checkboxes representing "VS Code / Cursor"  and Claude Code. On this page also we will explain that this application is designed to assist context for individual chats and facilitate easier prompting flow. There should also be one on there for Aider, but disabled for now.
Again based on The presence of our config file, we will pre populate The selection was on this page if we already have the information. The user is of course free at this point to edit their selections, which will be written back to our config file.
The selection on this page will dictate what happens on the following page. 

## MAIN PAGE (NEW CHAT)
On the following "main app" page for example if they have ticked cursor, and Claude Code, it will only display options relative to their environment selection.

First step is "Give this chat a name", For example "fix ui themeing"

This page is going to make assumptions immediately as to where the documents will reside within the folder structure. For now we will stick with a root location in the directory structure of our project "/docs". All of the context and prompts files we will be creating will be created and updated in this directory.
In the context window, it will open in markdown format with a default template IF there are no existing files already in the /docs dir.
The file names will be as follows:
cc_context.md
cc_prompt.md
cr_context.md
cr_prompt.md

## CONTEXT STEP
In this page we are not going to allow them to choose different context for different development environments. There is no point. I am just creating two files that will have the same content, which will allow the user to edit them in notepad or other if it suits them. This also applies to the prompt file. I am differentiating between these two, because we might be using both tools simultaneously while working on a project. Therefore we should have a tab created "per environment" with a editbale prompt box in which we can edit, dictate speech to text etc. Hence for each tab, we have to have the relevant controls to save the prompt, and then a friendly label indciating to "Type CCP" into your CC window to process this prompt. Just above the input area for the text, we will have a prominent "new prompt" btn, Which will save our prompt to a file within our wingman directory in the format:
<date like YYYYMMDD>_<time HHMM>.json. This will later allow us to open up a chat history and continue.

Our main page of the application, whereby it will have two tabs at the top one for context, and one for prompts. 
Again we will have to allow for any files in our wingman directory
In the context window, it will open in markdown format with a default template. We could also in this window specify the name of the project for example that we put in initially. The user can then fill in the blank template areas and hit save. This will create the relevant context files in the project directory for our applied environments.

## UI FLOW
A note on ui flow at this point, With each step we take we want an option at the top to step back, with the description of what's on the previous page, for example if we are on the context configuration page we will see the back button Saying new chat. If the user then stepped back it would have the existing chat name, with the option to start a new chat, and the flow into the context page starts again. This would show you the same context from the previous chat, allowing them to edit it or keep it the same for the next chat. Also for each new chat we should be saving the Context string into our JSON config file for the chat.

## PROMPTS
This page will involve as initially indicated, a main prompt window in which the user can use speech to text, edit etc. There will Tabs to represent each environment that was chosen, for example we might have a IDE tab, and a CLI (Claude Code) tab. The aforementioned prompt window for example will reside in each of these, with a corresponding prominent button saying save. There could also be some friendly reminder text here to tell them to for example type ccp in the claude code cli. At the top of this box will be a "new prompt" btn, which when clicked will save the previous prompt to our dated json file on disc, but not clear it In case these are just wants to edit it the next prompt sent. Note that on opening this dialogue the new chat button will be disabled and be above our main edit box, and whenever they click save we will save that snapshot of the prompt to our Jason file for this chat, and reenable the new chat button. This will allow the user to either edit the existing prompt text or clear the box. The "new prompt" btn We'll have another button alongside which will be "clear prompt window". Note that this clear prompt window button should also have a restore button beside it which appears when they clear the prompt. Therefore when we clear the box we will have to save in memory the last prompt that was in there to restore back to our text box. Also on this page will be a another tab, which will let us toggle the view so they can see a list of view of all the prompts and the date and time they were saved. The user can then scroll through and choose a prompt and click load. We don't have to maintain the history on this particular prompt, we were just learning it from the history into our life prompt box to allow the user to work with the prompt again.

I hope this all makes sense, and we will write this as a flutter web app, Whereby we will need to ensure that the window can be resized and not break anything, as they work with cloud code and cursor. For our development cycle obviously we'll be writing this from local hosts and then ultimately we will be pushing it up to fire base for access. One final point will be we will need a password prompt On app startup whereby we will have a hard coded password of "aihack", Which will then take us to the initial project selection folder screen etc.

This app will be written in Flutter using river pod to manage state throughout.





