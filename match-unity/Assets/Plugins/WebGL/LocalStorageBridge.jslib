mergeInto(LibraryManager.library, {
  GetMatchPayload: function () {
    var data = localStorage.getItem("fraktum_match_payload");
    if (!data) data = "";
    var bufferSize = lengthBytesUTF8(data) + 1;
    var buffer = _malloc(bufferSize);
    stringToUTF8(data, buffer, bufferSize);
    return buffer;
  },

  SetMatchResult: function (result) {
    var value = UTF8ToString(result);
    localStorage.setItem("fraktum_match_result", value);
  }
});