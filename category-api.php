<?php
function wpat_call_category_api(
  $content, $title, $actual_categories, $actual_tags, $post_id
) {
  $endpoint_url = 'https://api.wpautotag.com/categories/popular/';

  // get domain-level inputs to model
  $category_prior = wpat_get_category_prior();
  $domain = get_home_url();
  // prep body to send to api
  $data = array(
    'data' => [
      array(
        "text" => $content,
        "prior" => $category_prior,
        "actual_categories" => $actual_categories,
        "actual_tags" => $actual_tags,
        "domain" => $domain,
        "title" => $title,
        "post_id" => $post_id
      )
    ]
  );
  $body = json_encode($data);

  // get api key
  $wpat_api_key = get_option('wpat_api_key');
  if (!$wpat_api_key) {
    // api call will fail, return before even trying
    $null_api_key_msg = 'API key required, please add one on the ' .
      wpat_settings_link('settings page', true) . '.';
    return array('status_code' => 403, 'response' => $null_api_key_msg);
  }

  // make API call with wordpress http api
  $headers = [
    'Content-Type' => 'application/json',
    'x-api-key' => $wpat_api_key
  ];
  $options = [
      'body' => $body,
      'headers' => $headers,
  ];
  $response = wp_remote_post( $endpoint_url, $options );
  $raw_body = wp_remote_retrieve_body( $response );
  $body_decode = json_decode($raw_body);
  $status_code = wp_remote_retrieve_response_code( $response );

  // handle different status codes

  if ($status_code == 200) {
    $result = wpat_strcase(
      $body_decode[0]->predicted_category,
      get_option('wpat_capital_strategy_cat')
    );
  } else {
    $result = 'Error';
  }

  if ($status_code == 200) {
    $error_msg = '';
  } elseif ($status_code == 403) {
    if ($wpat_api_key) {
      $error_msg = 'Invalid API key';
    } else {
      $error_msg = $null_api_key_msg;
    }
  } elseif ($status_code == 429) {
    $error_msg = 'Too many requests. If this error persists, you may be over your
      monthly quota of API calls. Please contact
      <a href="mailto:hi@wpautotag.com">hi@wpautotag.com</a>.';
  } else {
    $error_msg = 'Error code: ' . $status_code . '<br>' . $body_decode->message;
  }

  // return status_code and sanitized response
  return array(
    'status_code' => $status_code,
    'response' => esc_attr($result),
    'error_msg' => $error_msg
  );
}
?>
