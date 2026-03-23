require 'sketchup'
require 'extensions'

module BlackMagician
  PLUGIN_DIR = File.dirname(__FILE__)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new('Black Magician', File.join(PLUGIN_DIR, 'black_magician', 'core', 'dialog.rb'))
    ext.description = 'Material deck & library manager'
    ext.version     = '0.1.0'
    ext.creator     = 'LEE'
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
