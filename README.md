# Random AI Prompt

**Ever wanted to get an endless supply of creative generations but running out of ideas, looking for new prompt inspiration, or just want to let a program handle the prompt wording?**

This is a javascript project that generates prompts. The original purpose
was to generate completely random prompts with completely random keywords because
it was discovered that they can often turn out pretty good and creative however
it has since evolved into giving you a wide range of control over prompt
generation.

You could sit here all day and just ask for more random images, filling up your folder with hundreds of creative images you never would have thought of if you tried to specify the prompt manually even going to bed at night and asking it to make a hundred or so completely random images throguhout the night.

* **[Skip to installation part, how do I install this?](#how-to-install-with-git)**
* **[Skip to FAQ, Why Javascript, why not WebUI, etc...](#faq)**

## Random Landscape

```
node . --dyn-prompts "landscape" --image-width 2048 --image-height 512 --anime-words

Prompt: landscape, Starflower, Plum tree, vegetation, Marouflage, Vintage Photography, Ghost imaging, Focus Stacking, [desaturated look|Lens Flares], Background light, god ray, light shaft, volumetric lighting, wada kazu, yomu sgt epper, wata do chinkuru
```

![1671157381915](https://user-images.githubusercontent.com/1305564/208066724-110f40a9-42c3-4825-9c2b-75b5c3be59d5.png)

## Random Room

```
node . --dyn-prompts "room" --image-width 2048 --image-height 512 --anime-words

Prompt: room, interrior, [Dining Room], grunge, rundown, broken floor, mold, shattered glass, ceiling hole, clutter, messy, furniture, accesories, Cabin building style, evening, myst, sunny, Industrial painting, Bracketing, Color Blast, Tiltshift
```

![1671157926331](https://user-images.githubusercontent.com/1305564/208067848-720f488c-7dc3-43a7-a751-e551a1a2b01c.png)

## Random Princess and Castle

```
node . --dyn-prompts "princess-simple,castle" --image-width 1920 --image-height 1088 --anime-words

Prompt: portrait, princess, royalty, woman, Quiff Haircut, up-close, sceptor, crown, robes, castle, roadview, moat, courtyard, castle keep, castle wall, castle drawbridge, Brigham City, lake, Cottage building style, dusk, vegetation, Bamboo, ((drizzle)), [Al-Qatt Al-Asiri|Glue-size], popqn
```

![1671160830692](https://user-images.githubusercontent.com/1305564/208071473-ecc07b97-5508-405b-b007-3636973ec005.png)

## Completely Random Anime

```
node . --anime-words

Prompt: grimoire, heiwajima shizuo, nihonga, pokemon frlg, single elbow glove, saigado
```

![1671185092541](https://user-images.githubusercontent.com/1305564/208074658-eef39d1d-46ad-476b-9ecf-8a4a3a2a47ab.png)

## Completely Random Non-Anime

```
node .

Prompt: boxcar, defenseless, [indubitable::2], [portage|Sweet], Robert Childress, Ejnar Nielsen, Hubert Robert
```

![1671185767246](https://user-images.githubusercontent.com/1305564/208076432-78593a5c-c3b5-47fb-a620-f445c37d9d3e.png)

## Random Non-Anime Room

```
node .

Prompt: room, interrior, Basement, dirty, rundown, broken, torn wallpaper, shattered glass, holes, ceiling hole, clutter, messy, furniture, accesories, window, Golden Ratio, [Multiple exposure:Kinetic Photography:3], Miniature Faking, god ray, light shaft, volumetric lighting, Brian Mashburn
```

![1671186220689](https://user-images.githubusercontent.com/1305564/208078096-1cfe82fa-6aab-4b77-8037-a80dda12eab9.png)

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

## Danbooru and anime are also supported

```
node . --dyn-prompts "landscape" --generate-images --anime-words

Prompt: landscape, Ixora, Peach tree, evening, i.u.y
```

![1670339397168](https://user-images.githubusercontent.com/1305564/205949915-e1eab384-2f42-4206-a109-d85d1d267e75.png)

## How to install with Git

1. Make sure git is installed
2. Make sure NodeJS is installed, version doesn't matter. [Link Here](https://nodejs.org)
3. Make sure to run WebUI with the command line parameters `--api`, this will be in your `webui-user.bat` file if your on Windows __**Very Important**__
4. Open a terminal in a folder of choice and run these commands

```
git clone https://github.com/junebug12851/random-ai-prompt.git
cd random-ai-prompt
npm install
node .
```

## How to install without Git

1. Download files

![image](https://user-images.githubusercontent.com/1305564/208082133-ff209076-1fb3-44ef-9a0d-c34f0f90a1e2.png)

2. Extract to folder of choice
3. Make sure to run WebUI with the command line parameters `--api`, this will be in your `webui-user.bat` file if your on Windows __**Very Important**__
4. Open terminal inside folder and run these commands

```
npm install
node .
```

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

## FAQ

### Where's the WebUI / GUI?

I'm not good at making one, I'm working on one in C++/Qt but it's honestly overwhelming. If anyone wished to help me develop a proper WebUI in HTML i'm open to it. I have a working API on here already that you can tap into, of course it may need some work.

### Why Javascript and not Python?

Cause I know javascript best, your welcome to make a python version, if you do, I'd appreciate a mention somewhere. I can even list it on here.

### Why not an extension for Automattic1111?

This would also be a good idea but noto nly do I not know python, I also really don't want to put in the work in re-writing this project and formatting it for a GUI. Like above, your welcome to do this if you want and I'd love a mention somewhere.
