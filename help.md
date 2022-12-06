## Usage

Most basic: Just use the defaults in settings
`node .`

## Settings

Change the settings here to adjust all the defaults:
```
settings.js
image-settings.js
upscale-settings.js
```

Command line arguments always have the final say

## Folders

### Presets

You can also have presets which can change any settings by adding a preset in the `./presets` folder
and running
```
node . --presets "preset1,preset2,preset3"
```
Presets can be useful for having different sizes, different prompts, or different negative keywords

These are loaded after settings but before comamnd line arguments

### Expansion

Expansions in `./expansions` take a string of text and dump it into the prompt when referenced.
This is good for commonly used prompts wording.

You reference expansion files with `<filename>` in the prompt

```
<rays>          => god ray, light shaft, volumetric lighting
<flower-pic>    => {flower}, {flower}, {artist}                 => Calla Lily, Daisy, Hans Hofmann
```

### Data

Everything in `./data` is a list, a list is a long text file with elements on new lines.
One is randomly chosen when referenced.

You reference lists with `{filename}`

```
{flower}            =>      Grape Hyacinth
```

By default, lists are guarenteed to be unique entries in a single prompt and non-repeating

### Dynamic Prompt

Dynamic code in `./dynamic-prompts` that is executed on each prompt, these form a chain, the prompt is
passed to the first dynamic prompt, then the output of that dynamic prompt is
passed to the next and so on until all dynamic prompt modules have been used.

Useful for dynamically generating certain prompts or modifying existing prompts
such as adding new features.

```
landscape       => Random landscape prompt
```

## Command Line Arguments

### The prompt

Within the prompt, you have access to these special lists which aren't real list
files.

```
{keyword}   Picks a keyword from whatever the currently selected dictionary is
{artist}    Picks an artist from whatever the current selected artist dictionary is
{random}    Picks a keyword from any list file in the data directory
{salt}      Replace with a random number in brackets
```

```
--prompt <prompt>                   The prompt to use
--negative-prompt <prompt>          The negative prompt to use
--hide-prompt <true/false>          Don't print the prompt to the console
```

### Prompt Salt

Adding `{salt}` will add a random 10-digit number to your prompt in square brackets
to add varation to the prompt. Once this number is added to the prompt, it will
automatically be re-updated everytime the prompt is re-used.

If you want to append a salt to the prompt automatically without using `{salt}`
then the arguemnt `--prompt-salt` will do it. It will skip over images that
already have a salt to prevent duplicate salting however if you wish you can add
multiple salts like so `{salt} {salt} etc...` and all of them will get updated
everytime.

```
--prompt-salt <true/false>			Auto-add prompt salt to the end of every prompt if not already there
```

### Auto Prompting

This is mainly used only when `{prompt}` or `{prompt-random}` is used in the prompt.

`{prompt}` will randomly select keywords from the current dictionary and artist dictionary
`{prompt-random}` will use words from all dictionaries

In your own prompt, `{keyword}` and `{artist}` will use the current dictionary
while `{random}` will use all dictionaries

```
--count <number>                    Number of keywords to generate randomly
--max-count <number>                Randomize the amount of keywords, and this is the max amount
--prompts <number>                  Number of prompts to generate
--emphasis <true/false>             Randomly emphasize / de-emphasize prompt keywords
--emphasis-chance <0.0-1.0>         Chance it will aquire an additional level of emphasis
--emphasis-max-levels <number>      Max level of emphasis
--de-emphasis-chance <0.0-1.0>      Chance it will be de-emphasized rather than emphasized
--use-artists <true/false>          Whether to allow artists to be used at all
--min-artists <number>              Minimum number of artists to add
--man-artists <number>              Maximum number of artists to add
--artists <name>                    Artist dictionary/list filename {artist} will reference this list
--dict <name>                       Keywords dictionary/list filename {keyword} will reference this list
```

### WebUI Interfacing

```
--generate-images <true/false>      Ask WebUI to make images
--upscale-images <true/false>       Ask WebUI to auto-upscale the new image it makes
```

### List Settings

```
--list-entries-once <true/false>    Allow list entries to be guarenteed unique
--reload-lists <true/false>         Don't persist list entry uniqueness across all prompts in a batch
```

### Folder Configuration

```
--list-files <path>                 Directory where lists files are
--expansion-files <path>            Path to the folder for expansion files
--preset-files <path>               Path to the folder for preset files
--dynamic-prompt-files <path>       Path to the folder for dynamic prompt files
--image-save-to <path>              Path to the folder for generated image files
```

### Dynamic Prompt Modules

```
--dyn-prompts <files>               Add in new dynamic prompt modules to the start of the chain
--all-dyn-prompts <files>           Customize the entire dyanmic prompt module chain, you will need to specify existing ones
```

### Variations and Upscales

```
--file-variations   Load generation settings of a certain file to make variations, command line arguments can override settings
--upscale-file      Upscale a particular image, you can use upscale arguments to customize it
```

### Connecting to Stable Diffusion

```
--webui-url <url>
```

### Image Generation

Self-explanatory

```
--image-sampler <sampler>
--image-steps <steps>
--image-width <width>
--image-height <height>
--image-restore-faces <true/false>
--image-denoising <0.0-1.0>
--images-per-prompt <number>
--image-cfg <number>
--image-seed <number>
--image-subseed-strength <0.0-1.0>
```

### Image Upscaling

Remember, if your wanting to upscale an existing image use `--upscale-file`,
otherwise it will auto-upscale a newly generated image.

```
--upscale-save-before <true/false>      Save image before auto-upscaling
--upscale-to-size <true/false>          If true, will upscale to exact dimensions, otherwise will upscale by a multiplier
--upscale-by <number>                   If --upscale-to-size is false, this is the multiplier number
--upscale-to-width <number>             If --upscale-to-size is true, this is the upscale width
--upscale-to-height <number>            If --upscale-to-size is true, this is the upscale height
--upscale-crop <true/false>             If --upscale-to-size is true, auto-crop to upscale dimensions
```

### Upscalers

```
--upscaler-1 <name>             Name of 1st upscaler
--upscaler-2 <name>             Name of 2nd upscaler
--upscaler-2-weight <0.0-1.0>   Weight of the two upscalers
```

### Upscale Face Restoration

```
--upscale-gfpgan <0.0-1.0>                  GFPGAN percentage to use on image
--upscale-code-former <0.0-1.0>             Codeformer percentage to use on image
--upscale-code-former-weight <0.0-1.0>      Codeformer weight compared to GFPGAN
--upscale-late-face-restore <true/false>    Fix faces after upscale (suggested to not use this)
```
