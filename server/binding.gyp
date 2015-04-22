{
  "conditions": [
    ["OS==\"linux\"",
      {
        "targets": [{
          "target_name": "avahi_pub",
          "sources": [ "binding/avahi_pub.cc" ],
          "cflags":
            [
              "-fpermissive",
            ],
          "libraries":
            [
              "-lavahi-client",
              "-lavahi-common"
            ]
          }]
      },
      {
        "targets": [{
          "target_name": "avahi_pub",
          "sources": [ "binding/avahi_pub.cc" ]
        }]
      }
    ]
  ]
}
