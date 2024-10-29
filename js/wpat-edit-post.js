const el = wp.element.createElement;
const __ = wp.i18n.__;
const Component = wp.element.Component;
const Button = wp.components.Button;
const CheckboxControl = wp.components.CheckboxControl;
const registerPlugin = wp.plugins.registerPlugin;
const registerStore = wp.data.registerStore;
const compose = wp.compose.compose;
const withSelect = wp.data.withSelect;
const withDispatch = wp.data.withDispatch;



// Register store for suggested category
// Reducer
const initial_state = {
    'suggestedCategory': ajax_object.suggested_category,
    'addedCatIds': [],
    'errorClass': ajax_object.error_msg,
    'isFetching': false
};
function reducer( state = initial_state, action ) {
  if ( action.type === 'SET_SUGGESTED_CATEGORY' ) {
    return {
      ...state,
      suggestedCategory: action.suggestedCategory
    };
  } else if (action.type === 'ADD_CATEGORY') {
    newState = {...state};
    newState.addedCatIds.push(action.addedCatId);
    return newState;
  } else if (action.type === 'SET_ERROR_CLASS') {
    return {
      ...state,
      errorClass: action.errorClass
    };
  } else if (action.type === 'SET_IS_FETCHING') {
    return {
      ...state,
      isFetching: action.isFetching
    };
  }
  return state;
};
// Selectors
const selectors = {
  getSuggestedCategory( state ) {
    return state.suggestedCategory;
  },
  getAddedCatIds( state ) {
    return state.addedCatIds;
  },
  getErrorClass( state ) {
    return state.errorClass;
  },
  getIsFetching( state ) {
    return state.isFetching;
  }

};
// Actions
const actions = {
  setSuggestedCategory( suggestedCategory ) {
    return {
      type: 'SET_SUGGESTED_CATEGORY',
      suggestedCategory: suggestedCategory
    };
  },
  addCatId( catId ) {
    return {
      type: 'ADD_CATEGORY',
      addedCatId: catId
    };
  },
  setErrorClass( errorClass ) {
    return {
      type: 'SET_ERROR_CLASS',
      errorClass: errorClass
    };
  },
  setIsFetching( isFetching ) {
    return {
      type: 'SET_IS_FETCHING',
      isFetching: isFetching
    };
  }

};
// Register
const wpatCategoryNamespace = 'wpautotag-plugin/suggested-category'
registerStore( wpatCategoryNamespace, {
  reducer,
  actions,
  selectors
} );

// Functions
function arrEqual(a, b) {
  return a.length === b.length && a.every(value => b.includes(value));
}
function swapKeyValue(obj, lowerNewKey=true){
  var ret = {};
  for(var key in obj){
    newKey = lowerNewKey ? obj[key].toLowerCase() : obj[key];
    ret[newKey] = key;
  }
  return ret;
}

// Component
class SuggestedCategoryComponent extends Component {
  // init and define subscriptions
  constructor() {
    super( ...arguments );
    this.maybeRefresh = this.maybeRefresh.bind( this );
    this.state = {
        suggestedCategory: this.props.getSuggestedCategory(),
        addedCatIds: this.props.getAddedCatIds(),
        errorClass: this.props.getErrorClass(),
        isFetching: this.props.getIsFetching()
    };
    wp.data.subscribe(this.maybeRefresh);
  };
  maybeRefresh(isRefreshing=false) {
    if (
      (this.props.newCatId) &&
      !(this.props.getAddedCatIds().includes(this.props.newCatId))
    ) {
      this.props.addCatId(this.props.newCatId);
    }
    // refresh suggested category if saving and edited post content
    // different from saved post content
    const contentEqual = this.props.postContent != this.props.savedPostContent
    const titleEqual = this.props.postTitle != this.props.savedPostTitle
    const catsEqual = arrEqual(
      this.props.actualCategories, this.props.savedActualCategories
    )
    const tagsEqual = arrEqual(
      this.props.actualTags, this.props.savedActualTags
    )
    const allEqual = contentEqual && titleEqual && catsEqual && tagsEqual
    if (
        (
          (this.props.isSavingPost || this.props.isAutosavingPost)
          && !allEqual && !this.state.isFetching
        ) || isRefreshing
    ) {
      // Get new suggested categories from API
      const payload = {
        'post_content': this.props.postContent,
        'post_title': this.props.postTitle,
        'actual_categories': this.props.actualCategories,
        'actual_tags': this.props.actualTags,
        'post_id': this.props.postId
      };
      // set isFetching to prevent multiple concurrent fetches
      // (always happens while saving)
      this.setState( { isFetching: true });
      this.props.setIsFetching(true);
      wp.apiRequest( {
        path: 'wpautotag/v1/category/suggest',
        method: 'POST',
        data: payload
      } ).then(
        ( data ) => {
          const newSuggestedCategory = data['response'];
          const errorClass = data['error_msg'];
          if (this.props.getSuggestedCategory() !== newSuggestedCategory) {
            // prevent infinite loop while saving
            // update rendered value
            this.setState( {
              suggestedCategory: newSuggestedCategory,
              errorClass: errorClass,
              isFetching: false
            });
            // set in datastore
            this.props.setSuggestedCategory(newSuggestedCategory);
            this.props.setErrorClass(errorClass);
            this.props.setIsFetching(false);
          }
        },
        ( err ) => {
          // update rendered value
          const errorMsg = `Unknown error. Save your progress and reload the
            page to get new suggestions.`;
          const errorCat = 'Error';
          this.setState( {
            suggestedCategory: errorCat,
            errorClass: errorMsg,
            isFetching: false
          });
          // set in datastore
          this.props.setSuggestedCategory(errorCat);
          this.props.setErrorClass(errorMsg);
          this.props.setIsFetching(false);
        }
      );
    };
  };

  // render
  render() {
    // check if suggested category is equivalent to a selected category
    var actCatLower = []
    this.props.actualCategories.forEach((cat) => {
      if (cat) {
        actCatLower.push(cat.toLowerCase())
      }
    });
    const isActualChecked = actCatLower.includes(
      this.state.suggestedCategory.toLowerCase()
    )
    // get id of suggested category
    const catNameIdMapLower = swapKeyValue(this.props.catIdNameMap, true)
    const catId = parseInt(
      catNameIdMapLower[
        this.state.suggestedCategory.toLowerCase()
      ], 10
    )
    return el(
      'div',
      {
        key: 'wpat_suggested_category_container',
        className: 'wpat_suggested_category_container'
      },
      [
        el(
          'p',
          {
            key: 'wpat_suggested_category_header',
            className: 'wpat_suggested_category_header'
          },
          __( 'Suggested Category', 'wpat' )
        ),
        el(
          'p',
          {
            key: 'wpat_suggested_category_error_msg',
            className: this.state.errorClass ?
              'wpat_api_error wpat_error_container' : 'wpat_error_container',
            dangerouslySetInnerHTML: {__html: this.state.errorClass}
          },
        ),
        el(
          'div',
          {
            key: 'wpat_suggested_category_actions',
            className: 'wpat_suggested_category_actions'
          },
          [
            el(
              CheckboxControl,
              {
                className: 'wpat_suggested_category_checkbox',
                key:  'wpat_suggested_category_checkbox',
                label: this.state.suggestedCategory,
                checked: isActualChecked,
                onChange: (updateChecked) => {
                  var newSelectedTerms = JSON.parse(
                    JSON.stringify(this.props.hierarchicalTermSelector.terms)
                  );
                  var suggestedTerm = JSON.parse(
                    JSON.stringify(
                      !catId ? this.state.suggestedCategory : ''
                    )
                  );
                  const termIdx = newSelectedTerms.indexOf(catId);

                  if ((termIdx > -1) && !updateChecked) {
                    // term selected and user wants to unassign
                    newSelectedTerms.splice(termIdx, 1);
                  } else if (catId && updateChecked) {
                    // term exists and user wants to assign
                    newSelectedTerms.push(catId);
                  } else if (!catId && updateChecked) {
                    // term doesn't exist and user wants to assign
                    // trigger add new term
                    let addTermButton = document.getElementsByClassName(
                      "editor-post-taxonomies__hierarchical-terms-add"
                    )[0]
                    addTermButton.onclick = function prefillNewTerm() {
                      if (this.getAttribute('aria-expanded') == 'false') {
                        // form opened, prefill new term
                        // (value is switched later, so trigger this when false)
                        var checkExist = setInterval(function() {
                          var elems = document.getElementsByClassName(
                            "editor-post-taxonomies__hierarchical-terms-input"
                          )
                          if (elems.length) {
                            // can't use the simple commented line below, see
                            // article below for why the complicated code is
                            // needed instead
                            // elems[0].value = suggestedTerm;
                            // https://hustle.bizongo.in/simulate-react-on-change-on-controlled-components-baa336920e04
                            var valSetter = Object.getOwnPropertyDescriptor(
                              window.HTMLInputElement.prototype, "value"
                            ).set;
                            valSetter.call(elems[0], suggestedTerm);
                            elems[0].dispatchEvent(
                              new Event('input', { bubbles: true })
                            );
                            clearInterval(checkExist);
                          }
                        }, 100); // check every 100ms
                      }
                    }
                    addTermButton.click();
                  }
                  // set state of suggested category checkbox
                  this.setState( {
                    checked: updateChecked
                  });
                  // set checked state of category in standard list
                  this.props.hierarchicalTermSelector.onUpdateTerms(
                    newSelectedTerms,
                    this.props.hierarchicalTermSelector.taxonomy.rest_base
                  );
                }
              }
            ),
            el(
              Button,
              {
                icon: 'image-rotate',
                label: 'Refresh suggested category',
                key: 'wpat_suggested_category_refresh',
                isSmall: true,
                showTooltip: true,
                className: 'wpat_suggested_category_refresh',
                iconSize: 16,
                onClick: () => {
                  this.maybeRefresh(true);
                }
              }
            )
          ]
        )
      ]
    );
  };
};

// Higher-order component to detect changes in post content, actual categories,
// and saving status
const SuggestedCategoryComponentHOC = compose( [
    withSelect( ( select ) => {
        const {
            isSavingPost,
            isAutosavingPost,
            hasChangedContent
        } = select( 'core/editor' );
        const {
            getSuggestedCategory,
            getAddedCatIds,
            getErrorClass,
            getIsFetching
        } = select( wpatCategoryNamespace );
        // content and title
        const postContent = select( "core/editor" ).getEditedPostContent();
        const savedPostContent = select( "core/editor" ).getCurrentPost().content;
        const postTitle = select( "core/editor" ).getCurrentPostAttribute( 'title' );
        const savedPostTitle = select( "core/editor" ).getCurrentPost().title;
        const postId = select( "core/editor" ).getCurrentPost().id;
        // categories
        const savedCatIds = select( 'core/editor' ).getCurrentPostAttribute( 'categories' );
        const catIds = select( 'core/editor' ).getEditedPostAttribute( 'categories' );
        const catObjs = select( 'core' ).getEntityRecords( 'taxonomy', 'category' );
        // tags
        const savedTagIds = select( 'core/editor' ).getCurrentPostAttribute( 'tags' );
        const tagIds = select( 'core/editor' ).getEditedPostAttribute( 'tags' );
        // why does this always return null the first time it's called?
        var tagObjs = select( 'core' ).getEntityRecords( 'taxonomy', 'post_tag' );
        tagObjs = select( 'core' ).getEntityRecords( 'taxonomy', 'post_tag' );
        // ids to names for categories
        const addedCatIds = getAddedCatIds();
        var newCatId = false;
        var catIdNameMap = {};
        if (catObjs) {
          catObjs.forEach((catObj, i) => {
            if (catObj.taxonomy === 'category') {
              catIdNameMap[catObj.id] = catObj.name;
            }
          });
        };
        if (addedCatIds.length) {
          addedCatIds.forEach((catId, i) => {
            catObj = select( 'core' ).getEntityRecord(
              'taxonomy', 'category', catId
            );
            if (typeof catObj !== 'undefined') {
              catIdNameMap[catId] = catObj.name;
            }
          });
        }
        // format array of actualCategories
        var actualCategories = [];
        if (catIds) {
          catIds.forEach((catId, i) => {
            let catName = catIdNameMap[catId];
            if (typeof catName === 'undefined') {
              // getEntityRecords doesn't update cache after adding term
              catObj = select( 'core' ).getEntityRecord(
                'taxonomy', 'category', catId
              );
              if (typeof catObj !== 'undefined') {
                catName = catObj.name;
                // add to catIdNameMap, which is missing this term in this case
                catIdNameMap[catId] = catName;
                // save to store so cat can be unassigned
                newCatId = catId;
              }
            }
            actualCategories.push(catName);
          });
        };
        var savedActualCategories = [];
        if (savedCatIds) {
          savedCatIds.forEach((catId, i) => {
            savedActualCategories.push(catIdNameMap[catId]);
          });
        };
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
              tagObj = select( 'core' ).getEntityRecord(
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
        var savedActualTags = [];
        if (savedTagIds) {
          savedTagIds.forEach((tagId, i) => {
            savedActualTags.push(tagIdNameMap[tagId]);
          });
        };

        return {
            isSavingPost: isSavingPost(),
            isAutosavingPost: isAutosavingPost(),
            postContent: postContent,
            savedPostContent: savedPostContent,
            postTitle: postTitle,
            savedPostTitle: savedPostTitle,
            actualCategories: actualCategories,
            savedActualCategories: savedActualCategories,
            actualTags: actualTags,
            savedActualTags: savedActualTags,
            catIdNameMap: catIdNameMap,
            getSuggestedCategory: getSuggestedCategory,
            getAddedCatIds: getAddedCatIds,
            getErrorClass: getErrorClass,
            getIsFetching: getIsFetching,
            newCatId: newCatId,
            postId: postId
        };
    } ),
    withDispatch( ( dispatch ) => {
        const {
            setSuggestedCategory,
            addCatId,
            setErrorClass,
            setIsFetching
        } = dispatch( wpatCategoryNamespace );
        return {
            setSuggestedCategory: setSuggestedCategory,
            addCatId: addCatId,
            setErrorClass: setErrorClass,
            setIsFetching: setIsFetching
        };
    } )
])( SuggestedCategoryComponent );

/**
 * Register sidebar plugin with block editor.
 */
registerPlugin( 'wpat-category-plugin', {
	render: SuggestedCategoryComponentHOC
} );

/**
 * Render suggested category above HierarchicalTermSelector
 */
function renderSuggestedCategoryComponent( OriginalComponent ) {
	return function( props ) {
		if ( props.slug === 'category' ) {
      return el(
        'div',
        {key: 'wpat_category_container_' + props.instanceId},
        [
          el(
            SuggestedCategoryComponentHOC,
            {
              key: 'wpat_suggested_category_container_' + props.instanceId,
              hierarchicalTermSelector: props
            },
          ),
          el(
            OriginalComponent,
            {
              ...props,
              key: 'wpat_standard_category_container_' + props.instanceId
            }
          )
        ]
      );
		} else {
      return el(
				OriginalComponent,
				props
      );
		}
	}
};
wp.hooks.addFilter(
	'editor.PostTaxonomyType',
	'wpat-category-plugin',
	renderSuggestedCategoryComponent
);
