jQuery(document).ready(function($) {
  // Begin suggested tags section
  var ajax_url = wpat_ajax_object_tags.ajax_url
  var img_dir = wpat_ajax_object_tags.img_dir

  // Call suggested tags API
  $('a.wpat-suggest-action-link').click(function(event) {
    event.preventDefault()

    var loading_img = '<img id="wpat_ajax_loading" src="' + img_dir + 'indicator.gif">'
    $('#wpat_suggested_tags .wpat_tag_container').html(loading_img)

    var payload = {
      'post_content': getContent(),
      'post_title': getTitle(),
      'actual_categories': getCategories(),
      'actual_tags': getTags(),
      'post_id': getPostID(),
      'tag_suggestion_type': $(this).data('ajaxaction')
    }
    console.log(payload)
    wp.apiRequest( {
      path: 'wpautotag/v1/tag/suggest',
      method: 'POST',
      data: payload
    } ).then(
      ( data ) => {
        // display suggestions
        // clear container
        $('#wpat_suggested_tags .wpat_tag_container').empty()
        if (data['status_code'] == 200) {
          var tag_scores = {}
          data['response'].forEach((tag_score_tup, i) => {
            tag_scores[tag_score_tup[0]] = tag_score_tup[1]
          });
          displaySuggestedTags(Object.keys(tag_scores))
        } else {
          // clear container
          $('#wpat_suggested_tags .wpat_tag_container').empty()
          // add error message
          $('#wpat_suggested_tags .wpat_tag_container').html(data['error_msg'])
          // add error class
          $('#wpat_suggested_tags .wpat_tag_container').addClass('wpat_api_error')
        }
      },
      ( err ) => {
        // clear container
        $('#wpat_suggested_tags .wpat_tag_container').empty()
        // add error message
        $('#wpat_suggested_tags .wpat_tag_container').html(err['error_msg'])
        // add error class
        $('#wpat_suggested_tags .wpat_tag_container').addClass('wpat_api_error')
      }
    );
    return false
  })

  function displaySuggestedTags(suggested_tags) {
    // remove error class if present
    $('#wpat_suggested_tags .wpat_tag_container').removeClass('wpat_api_error')
    // button to add all tags
    $('#wpat_suggested_tags .wpat_tag_container').append(
      '<span class="wpat_add_all_tags">ADD ALL TAGS</span>'
    )
    $('#wpat_suggested_tags .wpat_tag_container').append('<div class="clear"></div>')
    // add each suggested tag as a span within container
    for(var key in suggested_tags){
      $('#wpat_suggested_tags .wpat_tag_container').append(
        '<span class="wpat_add_single_tag">' + suggested_tags[key] + '</span>'
      )
    }
    $('#wpat_suggested_tags .wpat_tag_container').append('<div class="clear"></div>')

    // enable suggested tags to be added to post
    $('.wpat_add_single_tag').click(function(event) {
      event.preventDefault()
      addTags([this.innerHTML])
      $(this).addClass('used_term')
    })
    // enable button to add all tags
    $('.wpat_add_all_tags').click(function(event) {
      event.preventDefault()
      var tags = $('.wpat_add_single_tag').toArray().map(span => span.innerHTML);
      addTags(tags)
      $('.wpat_add_single_tag').each((i, span) => {
        $(span).addClass('used_term')
      });
    })
  }

  function getTitle() {
    var data = ''

    try {
      data = wp.data.select('core/editor').getEditedPostAttribute('title')
    } catch (error) {
      data = $('#title').val()
    }

    // Trim data
    data = data.replace(/^\s+/, '').replace(/\s+$/, '')
    if (data !== '') {
      data = strip_tags(data)
    }

    return data
  }

  function getContent() {
    var data = ''

    try { // Gutenberg
      data = wp.data.select('core/editor').getEditedPostAttribute('content')
    } catch (error) {
      try { // TinyMCE
        var ed = tinyMCE.activeEditor
        if ('mce_fullscreen' == ed.id) {
          tinyMCE.get('content').setContent(ed.getContent({
            format: 'raw'
          }), {
            format: 'raw'
          })
        }
        tinyMCE.get('content').save()
        data = $('#content').val()
      } catch (error) {
        try { // Quick Tags
          data = $('#content').val()
        } catch (error) {}
      }
    }

    // Trim data
    data = data.replace(/^\s+/, '').replace(/\s+$/, '')
    if (data !== '') {
      data = strip_tags(data)
    }

    return data
  }

  function getPostID() {
    var data = ''
    try { // Gutenberg
      data = wp.data.select( "core/editor" ).getCurrentPost().id
    } catch (error) {
      data = $('#post_ID').val()
    }
    return data
  }

  function getCategories() {
    // categories
    const catIds = wp.data.select( 'core/editor' ).getEditedPostAttribute( 'categories' );
    const catObjs = wp.data.select( 'core' ).getEntityRecords( 'taxonomy', 'category' );
    // ids to names for categories
    var catIdNameMap = {};
    if (catObjs) {
      catObjs.forEach((catObj, i) => {
        if (catObj.taxonomy === 'category') {
          catIdNameMap[catObj.id] = catObj.name;
        }
      });
    };
    // format array of actualCategories
    var actualCategories = [];
    if (catIds) {
      catIds.forEach((catId, i) => {
        let catName = catIdNameMap[catId];
        if (typeof catName === 'undefined') {
          // getEntityRecords doesn't update cache after adding term
          catObj = wp.data.select( 'core' ).getEntityRecord(
            'taxonomy', 'category', catId
          );
          if (typeof catObj !== 'undefined') {
            catName = catObj.name;
            // add to catIdNameMap, which is missing this term in this case
            catIdNameMap[catId] = catName;
          }
        }
        actualCategories.push(catName);
      });
    };
    return actualCategories
  }

  function getTags() {
    // tags
    const savedTagIds = wp.data.select( 'core/editor' ).getCurrentPostAttribute( 'tags' );
    const tagIds = wp.data.select( 'core/editor' ).getEditedPostAttribute( 'tags' );
    var tagObjs = wp.data.select( 'core' ).getEntityRecords( 'taxonomy', 'post_tag' );
    tagObjs = wp.data.select( 'core' ).getEntityRecords( 'taxonomy', 'post_tag' );
    // ids to names for tags
    var tagIdNameMap = {};
    if (tagObjs) {
      tagObjs.forEach((tagObj, i) => {
        if (tagObj.taxonomy === 'tag') {
          tagIdNameMap[tagObj.id] = tagObj.name;
        }
      });
    };
    // format array of actualTags
    var actualTags = [];
    if (tagIds) {
      tagIds.forEach((tagId, i) => {
        let tagName = tagIdNameMap[tagId];
        if (typeof tagName === 'undefined') {
          // getEntityRecords doesn't update cache after adding term
          tagObj = wp.data.select( 'core' ).getEntityRecord(
            'taxonomy', 'post_tag', tagId
          );
          if (typeof tagObj !== 'undefined') {
            tagName = tagObj.name;
            // add to tagIdNameMap, which is missing this term in this case
            tagIdNameMap[tagId] = tagName;
          }
        }
        actualTags.push(tagName);
      });
    };
    return actualTags
  }

  /**
   * The html_entity_decode() php function on JS :)
   *
   * See : https://github.com/hirak/phpjs
   *
   * @param str
   * @returns {string | *}
   */
  function html_entity_decode(str) {
    var ta = document.createElement('textarea')
    ta.innerHTML = str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    toReturn = ta.value
    ta = null
    return toReturn
  }

  /**
   * The strip_tags() php function on JS :)
   *
   * See : https://github.com/hirak/phpjs
   *
   * @param str
   * @returns {*}
   */
  function strip_tags(str) {
    return str.replace(/&lt;\/?[^&gt;]+&gt;/gi, '')
  }

  // Begin add tags section

  function addTags (tags) {
    console.log('adding tags ' + tags)
    // Trim tag
    tags = tags.map(tag => tag.replace(/^\s+/, '').replace(/\s+$/, ''))

    if (document.getElementById('new-tag-post_tag')) {
      console.log('adding tag with legacy WP UI')
      // Default tags input from WordPress

      // loop through all tags and append to list of tags
      tags.forEach((tag, i) => {
        tag.replace(/\s+,+\s*/g, ',').replace(/,+/g, ',').replace(/,+\s+,+/g, ',')
          .replace(/,+\s*$/g, '').replace(/^\s*,+/g, '')
        if ($('#new-tag-post_tag').val() === '') {
          $('#new-tag-post_tag').val(tag)
        } else {
          $('#new-tag-post_tag').val($('#new-tag-post_tag').val() + ', ' + tag)
        }
      })

    } else if (typeof wp.data != 'undefined'
      && typeof wp.data.select('core') != 'undefined'
      && typeof wp.data.select('core/edit-post') != 'undefined'
      && typeof wp.data.select('core/editor') != 'undefined') { // Gutenberg
      console.log('adding tag with Gutenberg')

      // Get current post_tags
      var tags_taxonomy = wp.data.select('core').getTaxonomy('post_tag')
      var tag_rest_base = tags_taxonomy && tags_taxonomy.rest_base
      var tag_ids = tag_rest_base && wp.data.select('core/editor')
        .getEditedPostAttribute(tag_rest_base)

      var newTags = JSON.parse(JSON.stringify(tag_ids));

      var data = {
    		'action': 'wpat_maybe_create_tags',
    		'tag_names': tags,
    	};
      console.log(data)
      $.post(ajax_url, data)
      .done(function(result){
        // loop through all tags and append to list of tags
        result.data.forEach((tag_data, i) => {
          if (tag_data.term_id > 0) {
            newTags.push(tag_data.term_id);
            newTags = newTags.filter(onlyUnique);
          }
        })

        var new_tag = {}
        new_tag[tag_rest_base] = newTags

        wp.data.dispatch('core/editor').editPost( new_tag );

        // open the tags panel
        if (wp.data.select('core/edit-post')
          .isEditorPanelOpened('taxonomy-panel-post_tag') === false) {
          wp.data.dispatch('core/edit-post')
            .toggleEditorPanelOpened('taxonomy-panel-post_tag');
        } else {
          wp.data.dispatch('core/edit-post')
            .toggleEditorPanelOpened('taxonomy-panel-post_tag');
          wp.data.dispatch('core/edit-post')
            .toggleEditorPanelOpened('taxonomy-panel-post_tag');
        }
      }).fail(function (err) {
        console.log('error when trying to create tag:', err)
      });
    } else {
      console.log('no tags input found...')
    }
  }
  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

})
