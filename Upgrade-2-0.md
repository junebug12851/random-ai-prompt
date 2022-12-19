# Moving to 2.0

2.0 introduces breaking changes, please take note of them to ensure a smooth
transition.

## Dynamic Prompts are not seperate anymore

Dynamic Prompts are now specified as part of the normal prompt prefixed with
a `#` symbol.

```
Old Code: --dyn-prompts "princess,castle" --noand --prompt-prefix "<candlelight> "

New code: --prompt "<candlelight>, #portrait-princess, #castle"
```

This gives much more flexibility and simplifies things

## There are now many dynamic prompts

Unlke before, Dynamic Prompts now represent any variable keywords, they can be something
as small as `#neon` which may produce a neon or glowy color or something as
large as `#city` which will produce many keywords to describe a city.

Please check them out in `./dynamic-prompts` folder and make use of them

## --noand removed

This was a flag that allowed combining prompts with or without `AND` in the old
system. In the new system, it is up to you to combine them which gives more
flexibility.

Here's how to replicate the old effects

```
Combine with AND:
--prompt "#portrait-princess AND #castle"

Combine without AND (Simulate --noand):
--prompt "#portrait-princess, #castle"

Combine with AND but more advanced:
--prompt "#portrait-princess :1.1 AND #castle :0.9"
```

## --prompt-prefix removed

This was a clunky system to add custom keywords to the start of a prompt when
using dynamic prompts. Now that dynamic prompts are properly part of the normal
prompt, this is no longer needed and therefore simplifies things.

Below you can see how much more readable and intuitive it becomes

```
Old Code: --dyn-prompts "person" --prompt-prefix "green hair "
New Code: --prompt "green hair #portrait-person"
```

## Prompt spacing auto-fix

If your prompt has extra spaces or commas or empty commas, their now auto-cleaned
up

```
#portrait-princess, ,,   #castle		=>	#portrait-princess, #castle
```

## Prompt Module Cleanup

Used to, there were psuedo lists, for example `{prompt}` would be a fake list
that would actually be a dynamic prompt which would print random keywords & artists.

This is just confusing and it's now been cleaned up

```
{prompt} 			=> 	#random		Print random keywords
					=> 	#artists	Print random artists
{prompt-danbooru}	=>	#danbooru	Print random danbooru keywords in a more controlled manner
```

Dynamic prompts which confusingly didnt generate keywords but just added new features
are now consudered prompt modules are are in a seperate folder.

This greatly simpifies things and sorts out confusion.

## Some have been renamed

Some of your dynamic prompts that were frequently used, have been forced to
be renamed.

```
princess 		=>		portrait-princess
person	 		=>		portrait-person
animal			=>		portrait-animal
underwater		=>		underwaterscape
```

The old names do still exist, but they now refer to simpler options which may
not be what you want. Apologies for the rename confusion.

## Dynamic prompts now stack better

Dynamic prompts no longer contain conflicting fluff keywords meaning their
much more flexible and stackable.

## Image Effects and Artists are now seperate

Used to, each dynamic prompt would add it's own list of image effects and
artists making things complicated and not-stackable well. Now they are seperate
dynamic prompts.

```
#fx 		=>	Image Effects
#artists 	=>	Artists
```

For your convinience, they will be automatically appended to the end of the prompt
so that you don't have to think about them. You can of course disable this
either in command arguents or user-settings.json

```
--auto-artists <true/false>
--auto-fx <true/false>
```

Some prompts do work better if artists and fx auto-append are disabled such as
the 3D print ones, in those cases, it will again be handled for you. when using
dynamic prompts that work best without #artists and/or #fx, they will be auto-disabled
but your welcome to always add them back manually if you really want to.

## --anime and --non-anime are renamed

When people saw `--anime` they assumed it meant it would make an anime image
but what it really meant is it would use danbooru words which are better for
making anime images and have no guarentee to the image being anime as that 
largely depends on the model file and prompt.

To prevent confusion, they have been renamed

```
--anime 		=> 	--anime-words
--non-anime 	=> 	--non-anime-words
```
