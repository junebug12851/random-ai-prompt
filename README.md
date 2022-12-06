# Random AI Prompt

This is a javascript project that generates prompts. The original purpose
was to generate completely random prompts with completely random keywords because
it was discovered that they can often turn out pretty good and creative however
it has since evolved into giving you a wide range of control over prompt
generation.

```
node .

Prompt: originality, Volkswagen, calling, esp, Unicode, hanger, Fujitsu, Hallsteinn Sigurðsson, Anne Mccaffrey, Ivan Aivazovsky
```

![1670337357423](https://user-images.githubusercontent.com/1305564/205940995-d73ad22d-0589-436a-a59a-b7589a103180.png)

## Command-line arguments

Command line arguments can be used to override any setting and give you a wide-range of control.

## WebUI API Supported

**Auto-Image Generation**
This program can connect to a Stable Diffusion WebUI running with the `--api`
command line argument and send generated prompts there to have them rendered
into images. It will then save the images into the outputs folder.

**Auto-Image Upscaling**
This program can also automatically ask Stable Diffusion to upscale and crop the
images if you prefer.

## Dynamic Prompt Modules

The program can be extended with dynamic prompt modules which can be loaded in.
Dynamic Prompt modules each have a turn in a load order to operate on the prompt,
either entirely replacing the prompt or modifying it such as adding special prompt
words.

```
node . --dyn-prompts "landscape" --generate-images

Prompt: landscape, Gaillardia, Catharanthus, Clematis, Prickly pear cactus, overcast, Winslow Homer
```

![1670338376088](https://user-images.githubusercontent.com/1305564/205946500-e172b23e-2944-4363-a693-f9879aeb033e.png)

## Expansions

Prompts phrases frequently used can be added into an expansion file which can
be expanded out nto a prompt. Expansion happen before any other dynamic prompt
modules meaning any special dynamic words in an expansion will be further 
expanded.

## Lists

Lists are the heart and soul of this prgram. A list is a text file with many
lines. When refenced, one of those lines will be randomly selected. By default,
referencing a list is guarenteed to pull a unique entry unless all entires have
been exaughsted.

There's a wide range of default lists available from vocabulary words to artists
to danbooru tags. You can ad your own custom lists in, some have already been made.

## Presets

There are many settings, all of the mcan be overrideen by command-line arguments,
but sometimes you want to have setting presets to save you time and effort. These
are simple script files that can add-in settings and even potential randomization.
