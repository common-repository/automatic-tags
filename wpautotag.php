<?php
   /*
   Plugin Name: Automatic Tags
   Plugin URI: https://wpautotag.com
   Description: Automatically tag and categorize your posts.
   Version: 0.1.0
   Author: Jared Rand
   Author URI: http://jrandblog.com
   License: GPLv3
   */

// $plugin_data = get_plugin_data( __FILE__ );
$plugin_data = get_file_data(__FILE__, array('Version' => 'Version'), false);
$plugin_version = $plugin_data['Version'];

define( 'WPAUTOTAG__PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WPAUTOTAG__PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WPAUTOTAG__PLUGIN_VER', $plugin_version );
require WPAUTOTAG__PLUGIN_DIR . 'callbacks.php';

/* Styles */
add_action( 'admin_print_styles', 'wpat_enqueue_styles');
function wpat_enqueue_styles() {
  wp_enqueue_style(
    'wpautotag_style',
    WPAUTOTAG__PLUGIN_URL . 'style.css',
    $ver=WPAUTOTAG__PLUGIN_VER
  );
}

/* Helpers for suggested category */
function wpat_get_category_prior() {
  $category_prior = array();
  $wpat_ignore_prior = get_option('wpat_ignore_prior');
  // get prior unless option to ignore is turned on
  if (get_option('wpat_ignore_prior') !== "1") {
    $raw_category_list = get_categories(array('count' => True));
    foreach ($raw_category_list as $category_obj) {
      $category_prior[$category_obj->name] = $category_obj->count;
    }
  }
  // clean
  if ($category_prior) {
    $category_prior = array_map('intval', $category_prior);
  } else {
    // if empty, cast to stdClass so empty dict will be passed to API
    $category_prior = new stdClass();
  }
  return $category_prior;
}
function wpat_get_actual_categories($post_id) {
  $raw_category_list = get_the_category($post_id);
  $actual_categories = array();
  foreach ($raw_category_list as $category_obj) {
    $actual_categories[] = $category_obj->name;
  }
  return $actual_categories;
}
function wpat_get_actual_tags($post_id) {
  $raw_tag_list = get_the_tags($post_id);
  $actual_tags = array();
  if ($raw_tag_list) {
    foreach ($raw_tag_list as $tag_obj) {
      $actual_tags[] = $tag_obj->name;
    }
  }
  return $actual_tags;
}
function wpat_strcase($str, $case='lower') {
  switch ($case) {
    case 'lower':
      return strtolower($str);
      break;
    case 'upper':
      return strtoupper($str);
      break;
    case 'title':
      return ucwords($str);
      break;
    case 'sentence':
      return ucfirst($str);
      break;
    default:
      return $str;
      break;
  }
}

/* JS for edit post */
add_action( 'admin_enqueue_scripts', 'wpat_script_enqueue_edit_post' );
function wpat_script_enqueue_edit_post($hook) {
  global $post;
  if ( $hook == 'post-new.php' || $hook == 'post.php' ) {
    wp_enqueue_script(
      'ajax-script-wpat-cats',
      plugins_url( '/js/wpat-cats.js', __FILE__ ),
      array('jquery')
    );
    wp_enqueue_script(
      'ajax-script-wpat-tags',
      plugins_url( '/js/wpat-tags.js', __FILE__ ),
      array('jquery')
    );
    $actual_categories = wpat_get_actual_categories($post->ID);
    $actual_tags = wpat_get_actual_tags($post->ID);
    $suggested_category = wpat_get_suggested_category(
      $post->post_content, $post->post_title,
      $actual_categories, $actual_tags, $post->ID
    );

  	wp_localize_script(
      'ajax-script-wpat-cats', 'wpat_ajax_object_cats',
      array(
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'suggested_category' => $suggested_category['response'],
        'error_msg' => $suggested_category['error_msg'],
      )
    );
    wp_localize_script(
      'ajax-script-wpat-tags', 'wpat_ajax_object_tags',
      array(
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'img_dir' => WPAUTOTAG__PLUGIN_URL . '/images/',
      )
    );
  }
}

/* Metabox for tag suggestions */
add_action( 'admin_menu', 'wpat_add_tag_suggestion_metabox');
function wpat_add_tag_suggestion_metabox() {
  add_meta_box( 'wpat_suggested_tags', wpat_get_tag_suggestion_header(),
  'wpat_tag_suggestion_metabox', 'post', 'advanced', 'core' );
}
function wpat_tag_suggestion_metabox() {
  ?>
  <span class="wpat_tag_container">
  Click a tag type to receive suggestions.
  <div class="clear"></div>
  </span>
  <?php
}
function wpat_get_tag_suggestion_header() {
  $html = '<div class="wpat-suggest-action-header">Suggested Tags</div>';
  $html .= '<a data-ajaxaction="match" class="wpat-suggest-action-link" href="#wpat_suggested_tags">' . __( 'Matches', 'wpat' ) . '</a>';
  $html .= '<a data-ajaxaction="keyword" class="wpat-suggest-action-link" href="#wpat_suggested_tags">' . __( 'Keywords', 'wpat' ) . '</a>';
  $html .= '<a data-ajaxaction="topic" class="wpat-suggest-action-link" href="#wpat_suggested_tags">' . __( 'Topics', 'wpat' ) . '</a>';
  $html .= '<div class="clear"></div>';

  return $html;
}



/* Admin page */
add_action('admin_menu', 'wpat_add_settings_page');
function wpat_add_settings_page() {
  add_options_page(
    'Automatic Tags Settings', 'Automatic Tags',
    'manage_options', 'wpautotag-settings', 'wpat_settings_page'
  );
}
function sanitize_option_wpat_capital_strategy_callback( $capital_strategy_val ) {
  $supported_vals = array("lower", "upper", "title", "sentence");
  if (!in_array($capital_strategy_val, $supported_vals)) {
      $capital_strategy_val = "";
  }
  return $capital_strategy_val;
}
add_filter(
  'sanitize_option_wpat_capital_strategy_cat',
  'sanitize_option_wpat_capital_strategy_callback'
);
add_filter(
  'sanitize_option_wpat_capital_strategy_tag',
  'sanitize_option_wpat_capital_strategy_callback'
);
function sanitize_option_wpat_api_key_callback( $api_key_val ) {
  return sanitize_text_field($api_key_val);
}
add_filter(
  'sanitize_option_wpat_api_key',
  'sanitize_option_wpat_api_key_callback'
);
function wpat_settings_page() {
  //must check that the user has the required capability
  if (!current_user_can('manage_options'))
  {
    wp_die( 'You do not have sufficient permissions to access this page.' );
  }

  // variables for the field and option names
  $api_key_name = 'wpat_api_key';
  $hidden_field_name = 'wpat_submit_hidden';
  $capital_strategy_name_cat = 'wpat_capital_strategy_cat';
  $capital_strategy_name_tag = 'wpat_capital_strategy_tag';
  $ignore_prior_name = 'wpat_ignore_prior';

  // Read in existing option value from database
  $api_key_val = get_option( $api_key_name );
  $capital_strategy_val_cat = get_option( $capital_strategy_name_cat );
  $capital_strategy_val_tag = get_option( $capital_strategy_name_tag );
  $ignore_prior_val = get_option( $ignore_prior_name );

  // See if the user has posted us some information
  // If they did, this hidden field will be set to 'Y'
  if( isset($_POST[ $hidden_field_name ]) && $_POST[ $hidden_field_name ] == 'Y' ) {
      // Read their posted value
      $api_key_val = sanitize_option( 'wpat_api_key', $_POST[ $api_key_name ] );
      $capital_strategy_val_cat = sanitize_option(
        'wpat_capital_strategy_cat',
        $_POST[ $capital_strategy_name_cat ]
      );
      $capital_strategy_val_tag = sanitize_option(
        'wpat_capital_strategy_tag',
        $_POST[ $capital_strategy_name_tag ]
      );
      $ignore_prior_val = isset($_POST[ $ignore_prior_name ]) ? "1" : "0";
      // Save the posted value in the database
      update_option( $api_key_name, $api_key_val );
      update_option( $capital_strategy_name_cat, $capital_strategy_val_cat );
      update_option( $capital_strategy_name_tag, $capital_strategy_val_tag );
      update_option( $ignore_prior_name, $ignore_prior_val );
      // Put a "settings saved" message on the screen
      ?>
      <div class="updated"><p><strong>
        Settings saved.
      </strong></p></div>
      <?php
  }

  // Now display the settings editing screen
  ?>
  <div class="wrap">
    <h2>Automatic Tags Settings</h2>
    <h3>Initial Setup</h3>
    <p>
      To receive category suggestions from this plugin, follow the steps below
      to get your free API key.
    </p>
    <ol>
      <li>
        Register on
        <a href="https://wpautotag.com/registration/" target="_blank">
          wpautotag.com</a>.
      </li>
      <li>
        Verify your email address.
      </li>
      <li>
        Find your API key on your
        <a href="https://wpautotag.com/my-account/api-key-item/" target="_blank
        ">
          profile page</a>.
      </li>
      <li>
        Copy and paste your API key into the box below and click "Save Changes."
      </li>
    </ol>
    <form name="wpat_admin" method="post" action="">
      <input type="hidden" name="<?php echo $hidden_field_name; ?>" value="Y">
      <label for="<?php echo $api_key_name; ?>">API Key</label>
      <input type="text" name="<?php echo $api_key_name; ?>"
        value="<?php echo esc_attr($api_key_val); ?>" size="35">

      <hr>
      <h3>Options</h3>
      <table class="form-table"><tbody>
        <tr>
          <th scope="row">
            <label for="<?php echo $capital_strategy_name_cat; ?>">
              How would you like suggested <strong>categories</strong> to be displayed?
            </label>
          </th>
          <td>
            <select name="<?php echo $capital_strategy_name_cat; ?>">
              <option value="lower"
                <?php echo $capital_strategy_val_cat == "lower" ? "selected" : ""; ?>
              >lower case</option>
              <option value="upper"
                <?php echo $capital_strategy_val_cat == "upper" ? "selected" : ""; ?>
              >UPPER CASE</option>
              <option value="title"
                <?php echo $capital_strategy_val_cat == "title" ? "selected" : ""; ?>
              >Capitalize First Letter Of Each Word</option>
              <option value="sentence"
                <?php echo $capital_strategy_val_cat == "sentence" ? "selected" : ""; ?>
              >Capitalize first letter of first word</option>
            </select>
          </td>
        </tr>
        <tr>
          <th scope="row">
            <label for="<?php echo $capital_strategy_name_tag; ?>">
              How would you like suggested <strong>tags</strong> to be displayed?
            </label>
          </th>
          <td>
            <select name="<?php echo $capital_strategy_name_tag; ?>">
              <option value="lower"
                <?php echo $capital_strategy_val_tag == "lower" ? "selected" : ""; ?>
              >lower case</option>
              <option value="upper"
                <?php echo $capital_strategy_val_tag == "upper" ? "selected" : ""; ?>
              >UPPER CASE</option>
              <option value="title"
                <?php echo $capital_strategy_val_tag == "title" ? "selected" : ""; ?>
              >Capitalize First Letter Of Each Word</option>
              <option value="sentence"
                <?php echo $capital_strategy_val_tag == "sentence" ? "selected" : ""; ?>
              >Capitalize first letter of first word</option>
            </select>
          </td>
        </tr>
        <tr>
          <th scope="row">
            <label for="<?php echo $ignore_prior_name; ?>">
              Get "blank slate" suggestions?
            </label>
          </th>
          <td>
            <input type="checkbox" name="<?php echo $ignore_prior_name; ?>"
              value="1"
              <?php echo $ignore_prior_val === "1" ? "checked" : ""; ?>
            >
            <p class="description">
              "Blank slate" suggestions ignore how often you've used
              categories in the past.
            </p>
            <p class="description">
              Consider turning this on if your suggestions are always your
              most popular category.
            </p>
          </td>
        </tr>
      </tbody></table>

      <p class="submit">
        <input type="submit" name="Submit" class="button-primary"
          value="<?php esc_attr_e('Save Changes') ?>" />
      </p>
    </form>
  </div>
  <?php
}
function wpat_settings_link($anchor_text, $new_tab=true) {
  if(!function_exists('menu_page_url')) {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
  }
  $target_str = $new_tab ?  'target="_blank"' : '';
  return '<a href="' .
    menu_page_url('wpautotag-settings', false) .
    '"' . $target_str . '>' . $anchor_text . '</a>';
}
function wpat_add_plugin_settings_link($links) {
  array_unshift($links, wpat_settings_link('Settings', false));
  return $links;
}
$plugin = plugin_basename(__FILE__);
add_filter("plugin_action_links_$plugin", 'wpat_add_plugin_settings_link' );

/* Activation */
register_activation_hook( __FILE__, 'wpat_admin_notice_activation_hook' );
function wpat_admin_notice_activation_hook() {
    set_transient( 'wpat_activation_admin_notice_transient', true, 5 );
}
add_action( 'admin_notices', 'wpat_admin_notice_upon_activation' );
function wpat_admin_notice_upon_activation(){
    /* Check transient, if available display notice */
    if( get_transient( 'wpat_activation_admin_notice_transient' ) ){
        ?>
        <div class="updated notice is-dismissible">
            <p>Thank you for using Automatic Tags. Go to the
              <?php echo wpat_settings_link('settings page', false); ?>
              to get started.
            </p>
        </div>
        <?php
        /* Delete transient, only display this notice once. */
        delete_transient( 'wpat_activation_admin_notice_transient' );
    }
}
?>
