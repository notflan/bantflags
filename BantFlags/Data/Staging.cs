﻿// (C) Copyright 2019 C-xC-c <boku@plum.moe>
// This file is part of BantFlags.
// BantFlags is licensed under the GNU AGPL Version 3.0 or later.
// see the LICENSE file or <https://www.gnu.org/licenses/>
using ImageMagick;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace BantFlags.Data
{
    public class Staging
    {
        public List<Flag> Flags { get; set; }
        public string Password { get; }

        public HashSet<string> Names { get; set; }

        public Staging(string password)
        {
            Flags = new List<Flag>();
            Password = password;
        }

        public void Clear()
        {
            Flags = new List<Flag>();
        }
    }

    public enum Method
    {
        Add = 0,

        Delete = 1,

        Rename = 2
    }

    public class Flag
    {
        public string Name { get; set; }

        public string OldName { get; set; }

        public bool IsChecked { get; set; }

        public Method FlagMethod { get; set; }

        // This is bad but we need it so Flags can be generated by the input tag helper
        public Flag()
        {
        }

        private Flag(string name, Method method)
        {
            Name = name;
            FlagMethod = method;
        }

        private Flag(string name, string oldName, Method method)
        {
            Name = name;
            OldName = oldName;
            FlagMethod = method;
        }

        public static Result<Flag> CreateFromDelete(string name)
            => Result<Flag>.Pass(new Flag(name, Method.Delete)); // We don't need any validation for deleted flags.

        public static Result<Flag> CreateFromRename(string oldName, string newName, HashSet<string> names)
        {
            Result<string> fileName = ValidateFileName(newName, names);

            if (fileName.Failed)
                return Result<Flag>.Fail(fileName.ErrorMessage);

            return Result<Flag>.Pass(new Flag(newName, oldName, Method.Rename));
        }

        public static async Task<Result<Flag>> CreateFromFile(IFormFile upload, HashSet<string> names)
        {
            byte[] PNGHeader = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

            if (upload.ContentType.ToLower() != "image/png")
                return Result<Flag>.Fail("Image must be a png.");

            if (upload.Length > 15 * 1024)
                return Result<Flag>.Fail("File too big. Max size is 15kb.");

            var name = Path.GetFileNameWithoutExtension(upload.FileName);

            Result<string> fileName = ValidateFileName(name, names);

            if (fileName.Failed)
                return Result<Flag>.Fail(fileName.ErrorMessage);

            using (var memoryStream = new MemoryStream())
            {
                await upload.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                using (var image = new MagickImage(memoryStream))
                {
                    if (image.Width != 16 || image.Height != 11)
                        return Result<Flag>.Fail("Invalid image dimensions. Flags should be 16px by 11px.");
                }

                using (var reader = new BinaryReader(memoryStream))
                {
                    reader.BaseStream.Position = 0;

                    if (!reader.ReadBytes(PNGHeader.Length).SequenceEqual(PNGHeader))
                        return Result<Flag>.Fail("Invalid png header.");
                }
            }

            return Result<Flag>.Pass(new Flag(name, Method.Add));
        }

        /// <summary>
        /// Filters file names created by users.
        /// </summary>
        /// <param name="name">The file name to validate.</param>
        /// <param name="names">The list of current file names.</param>
        private static Result<string> ValidateFileName(string name, HashSet<string> names)
        {
            if (string.IsNullOrWhiteSpace(name))
                return Result<string>.Fail("Flag name can't be empty.");

            if (name.Length > 100)
                return Result<string>.Fail("Flag name too long.");

            if (name == "empty, or there were errors. Re - set your flags.")
                return Result<string>.Fail("Invalid flag name.");

            if (name.Contains("||") || name.Contains(","))
                return Result<string>.Fail("Flag name contains invalid characters. You can't use \"||\" or \",\".");

            if (names.Contains(name))
                return Result<string>.Fail("A flag with that name already exists.");

            return Result<string>.Pass(name);
        }
    }
}