declare var chrome: any;
declare var browser: any;

import { MoulinetteSearch } from "./moulinette-search";
import { MoulinettePatreon } from "./moulinette-patreon";

/**
 * Request for toggling right panel
 */
(typeof browser !== "undefined" ? browser : chrome).runtime.onMessage.addListener((request : any) => {
  if(request.action === "togglePanel") {
    const panel = document.getElementById("moulinette-panel")
    if(panel) {
      panel.style.display = (panel.style.display == 'none') ? 'block' : 'none';
      document.getElementById("mtteSearch")?.focus()
    }
  }
  return Promise.resolve({ response: "Done" });
});


$(async function() {
  console.log("INITIALIZATION")

  // for some reasons, the moulinette part is getting added sometimes after the ready
  setTimeout(function() {
    console.log("Moulinette | Initializing Moulinette panel")

    const moulinette : any = { tab: "search" }
    const NO_RESULT = `<div class="mtteWarning">No result. Try with other search terms.</div>`

    /**
     * Bring focus to search field
     */
    $("#mtteSearch").trigger("focus")

    /**
     * Clears the UI
     */
    function moulinettePreviewClear() {
      $("#moulinette-preview .mtteTitle").html("Loading ...")
      $("#moulinette-preview .mtteImgPreview").attr("src", MoulinetteSearch.THUMB_DEFAULT);
      $("#moulinette-preview .mtteInfo").hide()
    }

    /**
     * Utility function to preview an image
     *  - if id is provided => searched
     *  - otherwise => browsed
     */
    async function moulinettePreview(id : string | null, creatorId : string, packId : string, assetPath : string) {
      // clear UI
      moulinettePreviewClear()
      $("#moulinette-preview").show()

      // load data
      const patreon = new MoulinettePatreon()
      const user = await patreon.getPatronUser()
      const client = await MoulinetteSearch.getUniqueInstance()
      user;

      let title   = "???"
      let creator = "???"
      let pack    = "???"
      let tiers   = "???"
      let url : string | null = ""

      if(id) {
        const doc = await client.getDocument(id)
        if(doc) {
          const data = await client.getPackDetails(doc.publisher, doc.pack)
          url = await client.getImageURL(id)
          $("#moulinette-preview .mtteImgPreview").css("width", url ? "300" : "100");
          $("#moulinette-preview .mtteImgPreview").css("height", url ? "300" : "100");
          if(!url) {
            url = `${MoulinetteSearch.THUMB_BASEURL}/${doc.base}/${doc.path}_thumb.webp`
          }
          const patreonURL = data ? data.publisherUrl : null
          let tierList = data ? data.tiers.map((t : any) => t.title) : null
          if(doc.perm.includes(0)) {
            tierList = ["- (Free)"]
          }

          title = doc.name.split("/").pop()
          creator = patreonURL ? `<a href="${data.publisherUrl}" target="_blank">${doc.publisher}</a>` : doc.publisher
          pack = doc.pack
          tiers = tierList ? tierList.join(", ") : "???"
        }
      }
      else {
        $("#moulinette-preview .mtteImgPreview").css("width", "300");
        $("#moulinette-preview .mtteImgPreview").css("height", "300");
        // retrieve pack
        const bCreator = moulinette.assets[creatorId]
        const bPack = bCreator.packs.find((p : any) => p.id == packId)
        url = `${bPack.path}/${assetPath}?${bPack.sas ? bPack.sas : ""}`
        title = assetPath.split("/").pop() || "???"
        creator = creatorId
        pack = bPack.name
        tiers = "???"
      }

      $("#moulinette-preview .mtteImgPreview").attr("src",url);
      // update image sizes
      $("#moulinette-preview .mtteImgPreview").on("load", function() {
        const image = document.querySelector("#moulinette-preview .mtteImgPreview") as HTMLImageElement;
        $("#moulinette-preview .mtteSize").html(`${image.naturalWidth} x ${image.naturalHeight}`)
      })

      $("#moulinette-preview .mtteTitle").html(title)
      $("#moulinette-preview .mtteCreator").html(creator)
      $("#moulinette-preview .mttePack").html(pack)
      $("#moulinette-preview .mtteTiers").html(tiers)
      $("#moulinette-preview .mtteInfo").show()
      if(tiers) {
        $(".mtteAvailability").show()
      } else {
        $(".mtteAvailability").hide()
      }
    }

    /**
     * Utility function for moulinette search
     */
    async function moulinetteSearch(terms : string, page = 1, allCreators = false) {
      const patreon = new MoulinettePatreon()
      const user = await patreon.getPatronUser()
      const client = await MoulinetteSearch.getUniqueInstance()
      if(terms && terms.length >= 3) {
        const results = await client.search(terms, page, allCreators ? null : user.pledges)
        // exception handling
        if(typeof results === 'string' || results instanceof String) {
          $("#mtteAssets").html(`<div class="mtteWarning">${results}</div>`);
          return;
        }
        let resultsHTML = ""
        moulinette.meta = results.meta
        results.results.forEach((r : any) => {
          resultsHTML += `<div class="mtteAsset" title="${r.name}" data-id="${r.id}" draggable="true" style="background-image: url('${encodeURI(r.url)}')"></div>`
        })
        if(page == 1) {
          $("#mtteAssets").html(resultsHTML)
        } else {
          $("#mtteAssets").append(resultsHTML)
        }

        // listener : dragging the image
        $(".mtteAsset").off()
        $(".mtteAsset").on('dragstart', function(ev) {
          changeDropZoneVisibility(true)
          const asset = $(ev.currentTarget)
          ev.originalEvent?.dataTransfer?.setData("Moulinette", JSON.stringify({
            id: asset.data("id"),
            name: asset?.attr("title")?.split("/").pop()
          }));
        });

        // listener : click => preview
        $('.mtteAsset').on("click", async function(ev) {
          const asset = $(ev.currentTarget)
          moulinettePreview(asset.data("id"), "", "", "")
        });

        $('.mtteAsset').on("mousedown", async function(ev) {
          if (ev.which === 3) {
            const asset = $(ev.currentTarget)
            const url = await client.getImageURL(asset.data("id"))
            if(url) {
              location.href = url
            } /*else if(data.id) {
              moulinettePreview(data.id, "", "", "")
            }*/
          }
        });

        // update counts
        const count = moulinette.meta.current == moulinette.meta.total_pages ? moulinette.meta.total_results : moulinette.meta.size * moulinette.meta.current
        $('#mtteStats').html(`1-${count} of ${moulinette.meta.total_results} results`)
      }
    }

    /**
     * Utility function for moulinette browse
     */
    async function moulinetteFilter(terms : string, creator : string) {
      const creators = MoulinetteSearch.filterAssets(moulinette.assets, creator, terms)

      // list assets
      let resultsHTML = ""
      Object.keys(creators).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(c => {
        creators[c].packs.forEach((p : any) => {
          resultsHTML += `<div class="tilefolder" data-creator="${c}" data-pack="${p.id}">${creator.length > 0 ? p.name : `<b>${c}</b> : ${p.name}`} (${p.assets.length})</div>`
        })
      })

      $("#mtteAssets").html(resultsHTML.length > 0 ? resultsHTML : NO_RESULT)

      // update counts
      let count = 0
      Object.keys(creators).forEach(c => count += creators[c].count)
      $('#mtteStats').html(`${count} results`)

      /* Expand folder */
      $("#mtteAssets .tilefolder").on("click", e => {
        const creator = $(e.currentTarget).data('creator')
        const pack = parseInt($(e.currentTarget).data('pack'))

        // data already loaded => toggle visibility
        if(e.currentTarget.classList.contains("mtteLoaded")) {
          $(`#mtteAssets .mtteAsset.p${pack}`).toggle();
          return;
        }
        // load data
        if(creators[creator]) {
          const selPack = creators[creator].packs.filter((p:any) => p.id === pack)
          if(selPack) {
            let html = ""
            selPack[0].assets.forEach((a:any) => {
              const imageURL = `${selPack[0].path}/${a.replace(".webp", "_thumb.webp")}?${selPack[0].sas ? selPack[0].sas : ""}`
              html += `<div class="mtteAsset p${selPack[0].id}" title="${a}" draggable="true" style="background-image: url('${imageURL}')"></div>`
            })
            $(e.currentTarget).after(html)

            // listener : dragging the image
            $(".mtteAsset").off()
            $(".mtteAsset").on('dragstart', function(ev) {
              changeDropZoneVisibility(true)
              const folder = $(ev.currentTarget).prevAll(".tilefolder:first");
              const assetPath = $(ev.currentTarget).attr("title")
              const bCreator = moulinette.assets[folder.data("creator")]
              const bPack = bCreator.packs.find((p:any) => p.id == folder.data("pack"))

              ev.originalEvent?.dataTransfer?.setData("Moulinette", JSON.stringify({
                url: `${bPack.path}/${assetPath}?${bPack.sas ? bPack.sas : ""}`,
                name: $(ev.currentTarget).attr("title")?.split("/").pop()
              }));
            });

            // listener : click => preview
            $('.mtteAsset').on("click", async function(ev) {
              const folder = $(ev.currentTarget).prevAll(".tilefolder:first");
              const asset = $(ev.currentTarget).attr("title") as string
              moulinettePreview(null, folder.data("creator"), folder.data("pack"), asset)
            });

            $('.mtteAsset').on("mousedown", async function(ev) {
              if (ev.which === 3) {
                const folder = $(ev.currentTarget).prevAll(".tilefolder:first");
                const assetPath = $(ev.currentTarget).attr("title")
                const bCreator = moulinette.assets[folder.data("creator")]
                const bPack = bCreator.packs.find((p:any) => p.id == folder.data("pack"))
                location.href = `${bPack.path}/${assetPath}?${bPack.sas ? bPack.sas : ""}`
              }
            });
          }
        }
        $(e.currentTarget).addClass('mtteLoaded')
      })
    }


    /**
     * Utility function to show/hide drop zone
     */
    function changeDropZoneVisibility(show = true) {
      if(show) {
        $("#moulinette-drop").show()
        $("#moulinette-panel .mtteActions").show()
      } else {
        $("#moulinette-drop").hide()
        $("#moulinette-panel .mtteActions").hide()
      }
    }

    /**
     * Trigger search when checkbox is clicked
     */
    $("#mtteAll").on("change", function() {
      moulinetteSearch($("#mtteSearch").val() as string, 1, $("#mtteAll").prop('checked'))
    })

    /**
     * Execute search
     */
    $("#mtteSearch").on("keyup", async function(e) {
      if(e.keyCode == 13) {
        if(moulinette.tab === "search") {
          moulinetteSearch($("#mtteSearch").val() as string, 1, $("#mtteAll").prop('checked'))
        } else if(moulinette.tab === "browse") {
          moulinetteFilter($("#mtteSearch").val() as string, $('#mtteCreators').find(":selected").val() as string)
        }
      }
    });

    /**
     * Switch tab
     */
    $("#mtteTabs span").on("click", async function(e) {
      if(e.currentTarget.classList.contains("active")) {
        return
      } else if(e.currentTarget.classList.contains("mtteBrowse")) {
        moulinette.tab = "browse"
        // adapt UI
        $(".mtteAll").hide()                              // hide "All creators" checkbox (for search)
        $("#mtteSearch").addClass("small")                // make search bar smaller
        $("#mtteCreators").css("display", "inline-block") // show filters (list of creators)
        $("#mtteCreators").html("<option>Loading...</option>")
        const client = await MoulinetteSearch.getUniqueInstance()
        if(!moulinette.assets) {
          console.log("Moulinette | Downloading asset list from server...")
          moulinette.assets = await client.getAssetsByCreator()
        }
        // update list of filters
        const creators = Object.keys(moulinette.assets).sort(function (a, b) {
          return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        const options = creators.map(c => `<option value="${c}">${c}</option>`)
        $("#mtteCreators").html("<option value=\"\">-- All creators --</option>" + options)
        moulinetteFilter($("#mtteSearch").val() as string, $('#mtteCreators').find(":selected").val() as string)


      } else if(e.currentTarget.classList.contains("mtteSearch")) {
        moulinette.tab = "search"
        // adapt UI
        $("#mtteCreators").hide()             // hide filters (list of creators)
        $("#mtteSearch").removeClass("small") // make search bar default size
        $(".mtteAll").show()                  // show "All creators" checkbox (for search)
        $("#mtteAssets").html("")
        moulinetteSearch($("#mtteSearch").val() as string, 1, $("#mtteAll").prop('checked'))
      }

      // highlight tab
      $("#mtteTabs span.active").removeClass("active")
      $(e.currentTarget).addClass("active")
    })

    /**
     * Scroll event
     */
    $("#mtteAssets").scroll(async function(event) {
      if(moulinette.tab == "browse") return;
      if(moulinette.ignoreScroll) return;
      const bottom = $(event.currentTarget).prop("scrollHeight") - ($(event.currentTarget).scrollTop() || 0)
      const height = $(event.currentTarget).height() || 0;
      //if(!this.searchResults) return;
      if(bottom - 20 < height) {
        if(moulinette.meta.current < moulinette.meta.total_pages) {
          moulinette.ignoreScroll = true // avoid multiple events to occur while scrolling
          await moulinetteSearch($("#mtteSearch").val() as string, moulinette.meta.current+1)
          moulinette.ignoreScroll = false
        }
      }
    });

    /**
     * User selected a creator in the filter (combo-box)
     */
    $("#mtteCreators").on("change", function() {
      moulinetteFilter($("#mtteSearch").val() as string, $('#mtteCreators').find(":selected").val() as string)
    })

    /**
     * User closes the preview window
     */
    $("#moulinette-preview button").on("click", () => $("#moulinette-preview").hide() )

    /**
     * Moulinette Drag & Drop events
     */
    $("#moulinette-drop").on('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
    })

    $("#moulinette-drop").on('dragenter', function(e) {
      e.preventDefault();
      e.stopPropagation();
    })

    $("#moulinette-drop").on("drop", async function(e) {
      changeDropZoneVisibility(false)
      const client = await MoulinetteSearch.getUniqueInstance()
      let data = e.originalEvent?.dataTransfer?.getData("Moulinette");
      if(data) {
        let jsonData = JSON.parse(data) as any
        
        // download the image from server
        const filename = jsonData.name + (jsonData.name.endsWith(".webp") ? "" : ".webp")
        const file = jsonData.url ? await client.downloadImage(jsonData.url, filename) : await client.downloadImageByIdName(jsonData.id, filename)
        if(file) {
          const dataTransfer = typeof browser !== "undefined" ? new (window as any).wrappedJSObject.DataTransfer() : new DataTransfer();
          dataTransfer.items.add(file);
          const event = new DragEvent('drop', {
            dataTransfer: dataTransfer,
            clientX: e.originalEvent?.clientX,
            clientY: e.originalEvent?.clientY
          });

          // dispatch events
          let cur = document.elementFromPoint(e.originalEvent!.clientX, e.originalEvent!.clientY)
          while(cur) {
            cur.dispatchEvent(event);
            cur = cur.parentElement
          }
        } else {
          if(jsonData.id) {
            moulinettePreview(jsonData.id, "", "", "")
          }
        }

      }
    });

    $("#moulinette-drop").on("click", () => {
      changeDropZoneVisibility(false)
    })

    $("#moulinette-panel .mtteActions").on('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
    })

    $("#moulinette-panel .mtteActions").on('dragenter', function(e) {
      e.preventDefault();
      e.stopPropagation();
    })

    $("#moulinette-panel .mtteActions").on('drop', async function(ev) {
      changeDropZoneVisibility(false)
      const client = await MoulinetteSearch.getUniqueInstance()
      let data = ev.originalEvent?.dataTransfer?.getData("Moulinette");
      if(data) {
        let jsonData = JSON.parse(data)
        const url = jsonData.url ? jsonData.url : await client.getImageURL(jsonData.id)
        if(url) {
          location.href = url
        } else if(jsonData.id) {
          moulinettePreview(jsonData.id, "", "", "")
        }
      }
      return false
    })

  }, 500);

});
