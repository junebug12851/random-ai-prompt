let name = "";
let imageData = {};
let curImgUrl = "";

function onPromptSelectionChange() {
    var selectedOption = $(this).val();

    if(selectedOption == "prompt")
        $('#keywords').text(imageData.prompt);
    else if(selectedOption == "negative")
        $('#keywords').text(imageData.negative_prompt);
    else if(selectedOption == "data")
        $('#keywords').text(JSON.stringify(imageData, null, 4));
    else if(selectedOption == "original")
        $('#keywords').text(imageData.origPrompt);
    else if(selectedOption == "post")
        $('#keywords').text(imageData.origPostPrompt);
    else if(selectedOption == "rnd")
        $('#keywords').text(imageData.origRandomPrompt);
    else if(selectedOption == "cmd")
        $('#keywords').text(imageData.cmd);

    if(selectedOption == "negative" || selectedOption == "cmd" || selectedOption == "data") {
        $("#generate-this").hide();
        $("#select-this").hide();
    }
    else {
        $("#generate-this").show();
        $("#select-this").show();
    }
}

function onVariationSelectionChange() {

    $("#variation-images").empty();

    var selectedOption = $("#variation-selection").val();

    if(selectedOption == "variations" && imageData.variations != undefined) {
        for(let i = 0; i < imageData.variations.length; i++) {
            const variation = imageData.variations[i];
            $("#variation-images").prepend(`
                <a href="/single?name=${variation.name}"><img src="${variation.imgPath}"/></a>
            `);
        }
    }

    if(selectedOption == "rerolls" && imageData.rerolls != undefined) {
        for(let i = 0; i < imageData.rerolls.length; i++) {
            const reroll = imageData.rerolls[i];
            $("#variation-images").prepend(`
                <a href="/single?name=${reroll.name}"><img src="${reroll.imgPath}"/></a>
            `);
        }
    }

    // Important to append to preserve frame order
    if(selectedOption == "animations" && imageData.animations != undefined) {
        for(let i = 0; i < imageData.animations.length; i++) {
            const animation = imageData.animations[i];
            $("#variation-images").append(`
                <a href="/single?name=${animation.name}"><img src="${animation.imgPath}"/></a>
            `);
        }
    }

    // Important to append to preserve frame order
    if(selectedOption == "animationFrames" && imageData.animationFrames != undefined) {
        for(let i = 0; i < imageData.animationFrames.length; i++) {
            const animationFrame = imageData.animationFrames[i];
            $("#variation-images").append(`
                <a href="/single?name=${animationFrame.name}"><img src="${animationFrame.imgPath}"/></a>
            `);
        }
    }

    if(selectedOption == "upscales" && imageData.upscales != undefined) {
        for(let i = 0; i < imageData.upscales.length; i++) {
            const upscale = imageData.upscales[i];
            $("#variation-images").prepend(`
                <img src="${upscale}" data-upscale="true"/>
            `);
        }

        $("#variation-images").prepend(`
                <img src="${imageData.imgPath}" data-upscale="true"/>
            `);

        $("#variation-images img[data-upscale='true']").click(function(event) {
            const src = event.target.src;
            $("#image").attr("src", src);
        });
    }
}

function completePage() {

    // Fill in prompt selection
    if(imageData.origPrompt)
        $('#prompt-selection').append('<option value="original">Original Prompt</option>');

    if(imageData.origPostPrompt)
        $('#prompt-selection').append('<option value="post">Post Prompt</option>');

    if(imageData.origRandomPrompt)
        $('#prompt-selection').append('<option value="rnd">Random Prompt</option>');

    if(imageData.cmd)
        $('#prompt-selection').append('<option value="cmd">Command</option>');

    // Fill-in default keywords
    $('#keywords').text(imageData.prompt);

    // Add timestamp
    let timestampReadable = "";

    if((typeof imageData.job_timestamp) == "number")
        timestampReadable = epochToDateString(imageData.job_timestamp);
    else {
        const timestamp = imageData.job_timestamp;
        const year = timestamp.substr(0, 4);
        const month = timestamp.substr(4, 2);
        const day = timestamp.substr(6, 2);
        let hour = timestamp.substr(8, 2);
        let isPm = false;
        if(hour > 12) {
            hour -= 12;
            isPm = true;
        }

        const minute = timestamp.substr(10, 2);
        isPm = (isPm) ? "pm" : "am";

        timestampReadable = `${month}/${day}/${year} ${hour}:${minute}${isPm}`;
    }

    $("#timestamp-cell").text(timestampReadable);

    if(imageData.variationOf != undefined || 
        imageData.rerollOf != undefined || 
        imageData.animationFrameOf != undefined ||
        imageData.animationOf != undefined) {
        $("#action-menu option[value='parent']").show();
        $("#action-menu option[value='parent']").prop('disabled', false);
    }

    let frameNumber = "";

    if(imageData.animatonFrameNumber != undefined)
        frameNumber = " #" + imageData.animatonFrameNumber;

    if(imageData.variationOf != undefined)
        $("#type-cell").text("Variation Image");
    else if(imageData.rerollOf != undefined)
        $("#type-cell").text("Re-rolled Image");
    else if(imageData.animationFrameOf != undefined)
        $("#type-cell").text("Animation Frame" + frameNumber);
    else if(imageData.isAnimation != undefined)
        $("#type-cell").text("Animation");
    else if(imageData.upscaleOf != undefined)
        $("#type-cell").text("Upscaled Image");
    else if(imageData.upscaleOf == undefined && imageData.isUpscale == true)
        $("#type-cell").text("Upscaled Replacing Base");
    else
        $("#type-cell").text("Base Image");

    if(imageData.variationOf == undefined) {
        $("#action-menu option[value='make-variations']").show();
        $("#action-menu option[value='make-variations']").prop('disabled', false);

        $("#action-menu option[value='select-variations']").show();
        $("#action-menu option[value='select-variations']").prop('disabled', false);
    }

    if(imageData.isAnimation != undefined) {
        $("#action-menu option[value='regen-anim']").show();
        $("#action-menu option[value='regen-anim']").prop('disabled', false);

        $("#action-menu option[value='select-extend-anim']").show();
        $("#action-menu option[value='select-extend-anim']").prop('disabled', false);

        $("#delete-frames").show();
    }

    // Not an animation or animation frame and has no associated animation
    if(imageData.animationFrameOf == undefined && imageData.isAnimation == undefined && imageData.animations == undefined) {
        $("#action-menu option[value='make-anim']").show();
        $("#action-menu option[value='make-anim']").prop('disabled', false);

        $("#action-menu option[value='select-make-anim']").show();
        $("#action-menu option[value='select-make-anim']").prop('disabled', false);
    }

    $("#model-cell").text(imageData.sd_model_hash);
    $("#seed-cell").text(imageData.seed);

    // Enable Variation Options if this is a variation image
    if(imageData.subseed_strength > 0 || imageData.variationOf != undefined) {
        $("#variation-seed-row").show();
        $("#variation-amount-row").show();

        $("#variation-seed-cell").text(imageData.subseed);
        $("#variation-amount-cell").text(+(imageData.subseed_strength * 100).toFixed(2) + "%");
    }

    $("#size-cell").text(`${imageData.width}x${imageData.height}`);

    // If we have a specifically set seed size different from the image size
    // Then show it here
    if((imageData.seed_resize_from_w > -1 && imageData.seed_resize_from_w != imageData.width) ||
        (imageData.seed_resize_from_h > -1 && imageData.seed_resize_from_h != imageData.height)) {

        $("#seed-size-row").show();

        const seedWidth = (imageData.seed_resize_from_w > -1) ? imageData.seed_resize_from_w : imageData.width;
        const seedHeight = (imageData.seed_resize_from_h > -1) ? imageData.seed_resize_from_h : imageData.height;

        $("#seed-size-cell").text(`${seedWidth}x${seedHeight}`);
    }

    if(imageData.upscaleWidth != undefined || imageData.upscaleHeight != undefined) {
        $("#upscale-size-row").show();
        $("#upscale-size-cell").text(`${imageData.upscaleWidth}x${imageData.upscaleHeight}`);
    }

    $("#sampler-cell").text(imageData.sampler_name);
    $("#cfg-cell").text(+imageData.cfg_scale.toFixed(2));
    $("#steps-cell").text(imageData.steps);

    const restoreFaces = (imageData.restore_faces) ? "Yes" : "No"
    const restoreFacesModel = (imageData.face_restoration_model == null || imageData.face_restoration_model == "None") ? "" : ` (${imageData.face_restoration_model})`;

    $("#restore-faces-cell").text(`${restoreFaces}${restoreFacesModel}`);

    const highResFix = (imageData.width > 512 || imageData.height > 512) ? true : false;

    if(highResFix) {
        $("#denoise-row").show();
        $("#denoising-cell").text(+(imageData.denoising_strength * 100).toFixed(2) + "%");
    }

    $("#filename-cell").text(imageData.name);
    $("#data-file-cell").html(`<a href="${imageData.dataPath}" rel="noopener noreferrer" target="_blank">${imageData.dataPath}</a>`);
    $("#image-file-cell").html(`<a href="${imageData.imgPath}" rel="noopener noreferrer" target="_blank">${imageData.imgPath}</a>`);

    for(let i = 0; i < imageData.keywordCloud.length; i++) {

        // Get keyword
        const keyword = imageData.keywordCloud[i];

        // Dynamic size fluctuates in pixels
        // Between 13-28 pixels
        const dynamicSize = keyword.percent * 15;
        const size = dynamicSize + 13;

        $("#keyword-cloud").append(`
            <li><a href="/?search=${keyword.keyword}" style="font-size: ${size}px" title="${keyword.count}">${keyword.keyword}</a></li>
        `);
    }

    // Set Image path
    $("#image").attr("src", imageData.imgPath);

    // Set Variation or upscale images

    if(imageData.upscales != undefined ||
        imageData.variations != undefined || 
        imageData.rerolls != undefined || 
        imageData.animations != undefined ||
        imageData.animationFrames != undefined)
        $("#variations-cell").show();

    if(imageData.variations != undefined)
        $("#variation-selection").append('<option value="variations">Variations</option>');

    if(imageData.rerolls != undefined)
        $("#variation-selection").append('<option value="rerolls">Re-Rolls</option>');

    if(imageData.animations != undefined)
        $("#variation-selection").append('<option value="animations">Animations</option>');

    if(imageData.animationFrames != undefined)
        $("#variation-selection").append('<option value="animationFrames">Animation Frames</option>');

    if(imageData.upscales != undefined)
        $("#variation-selection").append('<option value="upscales">Upscales</option>');

    onVariationSelectionChange();
}

function loadData() {
    $.ajax({
        type: 'GET',
        url: `/api/images/single/${name}`,
        success: function(data) {
            imageData = data;
            completePage();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function randomName() {
    $.ajax({
        type: 'GET',
        url: '/api/images/random-name',
        success: function(data) {
            window.location = `/single?name=${data}`;
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function rerollPrompt(isSelect) {

    const selectedOption = $("#prompt-selection").val();
    let fieldName = null;

    if(selectedOption == "prompt")
        fieldName = "prompt";
    else if(selectedOption == "original")
        fieldName = "origPrompt";
    else if(selectedOption == "post")
        fieldName = "origPostPrompt";
    else if(selectedOption == "rnd")
        fieldName = "origRandomPrompt";

    if(fieldName == null)
        return;

    // If selected, then send re-roll information to the generate page, otherwsie re-roll here with
    // default settings
    if(isSelect) {
        window.location = `/generate?reroll-file=${imageData.name}&reroll-field=${fieldName}&prompt=`;
        return;
    }

    $.ajax({
        type: 'GET',
        url: `/api/reroll-file/${imageData.name}/${fieldName}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    displayProgress();
}

function makeVariations() {
    $.ajax({
        type: 'GET',
        url: `/api/file-variation/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    displayProgress();
}

function makeAnimations() {

    // Set Generation state
    const state = {
        "generate-images": true,
        "to-animation-file": imageData.name,
    };

    // Save state
    localStorage.setItem('generateSettings', JSON.stringify(state));

    // Post it
    $.ajax({
        type: 'POST',
        url: `/api/generate-full`,
        data: JSON.stringify(state),
        contentType: 'application/json',
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
    });

    displayProgress(true);
}

function selectVariations() {
    window.location = `/generate?file-variations=${imageData.name}&prompt=`;
}

function selectAnimation() {
    window.location = `/generate?to-animation-file=${imageData.name}&animation-starting-frame=1&animation-frames=5&prompt=`;
}

function upscaleFile() {
    $.ajax({
        type: 'GET',
        url: `/api/upscale-file/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    displayProgress(false, true);
}

function selectUpscale() {
    window.location = `/generate?upscale-file=${imageData.name}&prompt=`;
}

function onReroll() {
    rerollPrompt();
}

function onRerollSelect() {
    rerollPrompt(true);
}

function copyPrompt() {
    const text = $('#keywords').text();

    const tempInput = $('<input>');
    $('body').append(tempInput);
    tempInput.val(text).select();
    document.execCommand('copy');
    tempInput.remove();
};

function deleteFile() {
    $.ajax({
        type: 'GET',
        url: `/api/images/delete/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    reindexHome();
}

function deleteFrames() {
    $.ajax({
        type: 'GET',
        url: `/api/animation/delete/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    reindexHome();
}

async function regenAnim() {

    // Just reload, this is relatively fast
    await ajaxGet(`/api/file-update-animation/${imageData.name}`);
    window.location.reload();
}

function actionMenuSelection() {

    // Get selected value
    const selectedValue = $(this).val();

    if(selectedValue == "make-variations")
        makeVariations();
    else if(selectedValue == "make-upscale")
        upscaleFile();
    else if(selectedValue == "make-anim")
        makeAnimations();
    else if(selectedValue == "download")
        window.location = `/download/${imageData.name}.png`;
    else if(selectedValue == "parent") {
        if(imageData.variationOf != undefined)
            window.location = `/single?name=${imageData.variationOf}`;
        else if(imageData.rerollOf != undefined)
            window.location = `/single?name=${imageData.rerollOf}`;
        else if(imageData.animationFrameOf != undefined)
            window.location = `/single?name=${imageData.animationFrameOf}`;
        else if(imageData.animationOf != undefined)
            window.location = `/single?name=${imageData.animationOf}`;
    }
    else if(selectedValue == "select-variations")
        selectVariations();
    else if(selectedValue == "select-upscale")
        selectUpscale();
    else if(selectedValue == "select-make-anim")
        selectAnimation();
    else if(selectedValue == "regen-anim")
        regenAnim();
    else if(selectedValue == "select-extend-anim") {
        window.location = `/generate?animation-starting-frame=5&animation-frames=5&extend-animation-file=${imageData.name}&prompt=`;
    }

    $(this).prop('selectedIndex', 0);
}

$(document).ready(function() {
    const params = getUrlParameters();
    const _name = params.name;

    if(_name == undefined)
        randomName();
    else {
        name = _name;
        loadData();
    }

    // Listen for insert menu change
    $("#action-menu").change(actionMenuSelection);

    $('#prompt-selection').change(onPromptSelectionChange);
    $('#generate-this').click(onReroll);
    $('#select-this').click(onRerollSelect);
    $('#copy').click(copyPrompt);
    $("#delete-confirmation-yes").click(deleteFile);
    $("#delete-frames-confirmation-yes").click(deleteFrames);
    $('#variation-selection').change(onVariationSelectionChange);

    $("#delete").click(() => {
        $("#delete").hide();
        $("#delete-confirmation-yes").show();
        $("#delete-confirmation-no").show();
    });

    $("#delete-frames").click(() => {
        $("#delete-frames").hide();
        $("#delete-frames-confirmation-yes").show();
        $("#delete-frames-confirmation-no").show();
    });

    $("#delete-confirmation-no").click(() => {
        $("#delete").show();
        $("#delete-confirmation-yes").hide();
        $("#delete-confirmation-no").hide();
    });

    $("#delete-frames-confirmation-no").click(() => {
        $("#delete-frames").show();
        $("#delete-frames-confirmation-yes").hide();
        $("#delete-frames-confirmation-no").hide();
    });
});
