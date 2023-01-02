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
            $("#variation-images").append(`
                <a href="/single?name=${variation.name}"><img src="${variation.imgPath}"/></a>
            `);
        }
    }

    if(selectedOption == "rerolls" && imageData.rerolls != undefined) {
        for(let i = 0; i < imageData.rerolls.length; i++) {
            const reroll = imageData.rerolls[i];
            $("#variation-images").append(`
                <a href="/single?name=${reroll.name}"><img src="${reroll.imgPath}"/></a>
            `);
        }
    }

    if(selectedOption == "upscales" && imageData.upscales != undefined) {
        for(let i = 0; i < imageData.upscales.length; i++) {
            const upscale = imageData.upscales[i];
            $("#variation-images").append(`
                <img src="${upscale}"/>
            `);

            $("#variation-images").click(function(event) {
                const src = event.target.src;
                $("#image").attr("src", src);
            });
        }
    }
}

function completePage() {

    // Fill in prompt selection
    if(imageData.origPrompt)
        $('#prompt-selection').append('<option value="original">Original Prompt</option>');

    if(imageData.origPostPrompt)
        $('#prompt-selection').append('<option value="post">Post Prompt</option>');

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

    if(imageData.variationOf != undefined || imageData.rerollOf != undefined)
        $("#parent").show();

    if(imageData.variationOf != undefined)
        $("#type-cell").text("Variation Image");
    else if(imageData.rerollOf != undefined)
        $("#type-cell").text("Re-rolled Image");
    else if(imageData.upscaleOf != undefined)
        $("#type-cell").text("Upscaled Image");
    else if(imageData.upscaleOf == undefined && imageData.isUpscale == true)
        $("#type-cell").text("Upscaled Replacing Base");
    else
        $("#type-cell").text("Base Image");

    if(imageData.variationOf == undefined) {
        $("#make-variations").show();
        $("#select-variations").show();
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

    if(imageData.upscales != undefined || imageData.variations != undefined || imageData.rerolls != undefined)
        $("#variations-cell").show();

    if(imageData.variations != undefined)
        $("#variation-selection").append('<option value="variations">Variations</option>');

    if(imageData.rerolls != undefined)
        $("#variation-selection").append('<option value="rerolls">Re-Rolls</option>');

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

function selectVariations() {
    window.location = `/generate?file-variations=${imageData.name}&prompt=`;
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

$(document).ready(function() {
    const params = getUrlParameters();
    const _name = params.name;

    if(_name == undefined)
        randomName();
    else {
        name = _name;
        loadData();
    }

    $('#prompt-selection').change(onPromptSelectionChange);
    $('#generate-this').click(onReroll);
    $('#select-this').click(onRerollSelect);
    $('#copy').click(copyPrompt);
    $("#make-variations").click(makeVariations);
    $("#select-variations").click(selectVariations);
    $("#make-upscale").click(upscaleFile);
    $("#select-upscale").click(selectUpscale);
    $("#download").click(() => {
        window.location = `/download/${imageData.name}.png`;
    });
    $("#parent").click(() => {
        if(imageData.variationOf != undefined)
            window.location = `/single?name=${imageData.variationOf}`;
        else if(imageData.rerollOf != undefined)
            window.location = `/single?name=${imageData.rerollOf}`;
    });
    $("#delete-confirmation-yes").click(deleteFile);
    $('#variation-selection').change(onVariationSelectionChange);

    $("#delete").click(() => {
        $("#delete").hide();
        $("#delete-confirmation-yes").show();
        $("#delete-confirmation-no").show();
    });

    $("#delete-confirmation-no").click(() => {
        $("#delete").show();
        $("#delete-confirmation-yes").hide();
        $("#delete-confirmation-no").hide();
    });
});
