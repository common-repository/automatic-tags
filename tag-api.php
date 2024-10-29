<?php
function wpat_call_tags_api(
  $content, $title, $actual_categories, $actual_tags, $post_id,
  $tag_suggestion_type
) {
  switch ($tag_suggestion_type) {
    case "keyword":
      $endpoint_url = 'https://api.wpautotag.com/tags/keyphrases/';
      break;
    case "topic":
      $endpoint_url = 'https://api.wpautotag.com/tags/topics/';
      break;
    default:
      $endpoint_url = 'https://api.wpautotag.com/tags/keyphrases/';
  }

  // get domain-level inputs to model
  $domain = get_home_url();
  // prep body to send to api
  $data = array(
    'data' => [
      array(
        "text" => $content,
        "actual_categories" => $actual_categories,
        "actual_tags" => $actual_tags,
        "domain" => $domain,
        "title" => $title,
        "post_id" => $post_id,
        "tag_suggestion_type" => $tag_suggestion_type
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
    $result_raw = $body_decode[0];
    $capital_strategy = get_option('wpat_capital_strategy_tag');
    // exclude actual tags, apply capital strategy, and filter low confidence
    // suggestions
    $result = array();
    foreach($result_raw as $tup) {
        if(!in_array(
          strtolower($tup[0]), array_map("strtolower", $actual_tags)
        )){
          // filter low confidence
          $skip = ($tag_suggestion_type == "topic") & ($tup[1] < 1.4);
          if (!$skip) {
            $tag_name = wpat_strcase($tup[0], $capital_strategy);
            $result[] = array($tag_name, $tup[1]);
          }
        }
    }
  } else {
    $result = 'Error';
  }

  if ($status_code == 200) {
    $error_msg = '';
  } elseif ($status_code == 403) {
    if ($wpat_api_key) {
      $error_msg = 'Invalid API key | ' . '<br>' . $body_decode->message;
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
    'response' => $result,
    'error_msg' => $error_msg
  );
}

function wpat_get_local_match_tags(
  $content, $title, $actual_tags
) {
  // suggest local tags
  // loop through existing local tags not in $actual_tags and check whether
  // each is present in $content or $title
  $all_tags = get_tags();
  $matched_names = array();
  $matched_scores = array();
  $content_lower = strtolower($content);
  $title_lower = strtolower($title);
  $title_weight = 5;
  foreach ($all_tags as $tag) {
    // check if tag in $content or $title
    $content_count = substr_count($content_lower, strtolower($tag->name));
    $title_count = substr_count($title_lower, strtolower($tag->name));
    // compute score
    $score = ($content_count + ($title_count * $title_weight)) * (log($tag->count + 1) + 1);
    // if non-zero score, add tuple of name and score to array to be returned
    if (($score > 0) and !(in_array(
        strtolower($tag->name), array_map("strtolower", $actual_tags)
    ))) {
      $matched_names[] = $tag->name;
      $matched_scores[] = $score;
    }
  }
  // sort by scores
  array_multisort(
    $matched_scores, SORT_DESC, SORT_NUMERIC,
    $matched_names, SORT_ASC, SORT_STRING
  );
  // zip into array of tuples
  $matches = array_map(null, $matched_names, $matched_scores);

  return $matches;
}

?>
